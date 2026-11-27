import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";

/**
 * Busca estruturada na base Agrofit local (ver scripts/agrofit-sync.ts).
 * Consulta direta ao Postgres, sem LLM: é determinística, instantânea e não
 * tem custo por consulta.
 */

export interface FiltrosAgrofit {
  texto?: string | null;
  cultura?: string | null;
  praga?: string | null;
  ingrediente?: string | null;
  titular?: string | null;
  classe?: string | null;
  biologico?: boolean;
  organico?: boolean;
}

const como = (v: string) => `%${v}%`;

/**
 * Valor que o MAPA usa para registro sem cultura específica. Quase todo
 * biológico está assim (795 de 834): filtrar por "Pitaya" sem somar estes
 * esconderia os biológicos e daria a impressão de que não há registro.
 */
const TODAS_AS_CULTURAS = "Todas as culturas";

/**
 * Condição sobre uma linha de agrofit_indicacoes. Cultura e praga casam na
 * MESMA indicação — cruzá-las em linhas diferentes acharia produto registrado
 * para a praga em outra cultura.
 *
 * `somenteNominal` exige a cultura nomeada, sem aceitar o registro geral: é o
 * que separa, na listagem, quem vale "por Todas as culturas".
 */
function indicacaoCasa(
  f: Pick<FiltrosAgrofit, "cultura" | "praga">,
  alias: SQL,
  somenteNominal = false,
): SQL {
  const cond: SQL[] = [sql`${alias}.registration = p.registration`];
  if (f.cultura) {
    const nomeada = sql`${alias}.cultura ILIKE ${como(f.cultura)}`;
    cond.push(
      somenteNominal
        ? sql`(${nomeada} AND ${alias}.cultura <> ${TODAS_AS_CULTURAS})`
        : sql`(${nomeada} OR ${alias}.cultura = ${TODAS_AS_CULTURAS})`,
    );
  }
  if (f.praga) {
    cond.push(
      sql`(${alias}.praga_nome_comum ILIKE ${como(f.praga)} OR ${alias}.praga_nome_cientifico ILIKE ${como(f.praga)})`,
    );
  }
  return sql.join(cond, sql` AND `);
}

/** Produto que só entrou pelo registro geral: nenhuma indicação nomeia a cultura. */
function viaTodasAsCulturas(f: FiltrosAgrofit): SQL {
  if (!f.cultura) return sql`false`;
  return sql`NOT EXISTS (
    SELECT 1 FROM agrofit_indicacoes n WHERE ${indicacaoCasa(f, sql`n`, true)}
  )`;
}

/**
 * Cultura e praga filtram por agrofit_indicacoes via EXISTS, não por JOIN —
 * o JOIN duplicaria o produto uma vez por indicação que casasse, quebrando a
 * paginação e a contagem total.
 */
function condicoes(f: FiltrosAgrofit): SQL {
  const cond: SQL[] = [sql`true`];

  if (f.texto) {
    cond.push(
      sql`(p.product_name ILIKE ${como(f.texto)} OR p.registration ILIKE ${como(f.texto)})`,
    );
  }
  if (f.ingrediente) cond.push(sql`p.active_ingredient ILIKE ${como(f.ingrediente)}`);
  if (f.titular) cond.push(sql`p.holder ILIKE ${como(f.titular)}`);
  if (f.classe) cond.push(sql`p.product_class ILIKE ${como(f.classe)}`);
  if (f.biologico) cond.push(sql`p.produto_biologico IS TRUE`);
  if (f.organico) cond.push(sql`p.agricultura_organica IS TRUE`);

  if (f.cultura || f.praga) {
    cond.push(sql`EXISTS (SELECT 1 FROM agrofit_indicacoes i WHERE ${indicacaoCasa(f, sql`i`)})`);
  }

  return sql.join(cond, sql` AND `);
}

export async function buscarProdutos(
  f: FiltrosAgrofit,
  pagina: number,
  tamanho: number,
) {
  const onde = condicoes(f);

  const { rows: contagem } = await db.execute<{ total: string; via_todas: string }>(sql`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE ${viaTodasAsCulturas(f)}) AS via_todas
    FROM agrofit_products p WHERE ${onde}
  `);
  const total = Number(contagem?.[0]?.total ?? 0);

  const { rows } = await db.execute(sql`
    SELECT
      p.registration,
      p.product_name,
      p.active_ingredient,
      p.product_class,
      p.holder,
      p.formulacao,
      p.modo_acao,
      p.toxicological_class,
      p.environmental_class,
      p.produto_biologico,
      p.agricultura_organica,
      p.url_agrofit,
      (SELECT count(DISTINCT c.cultura)
         FROM agrofit_indicacoes c
        WHERE c.registration = p.registration) AS n_culturas,
      ${
        f.cultura
          ? sql`(SELECT string_agg(DISTINCT coalesce(nullif(a.praga_nome_comum, ''), a.praga_nome_cientifico), ', ')
                   FROM agrofit_indicacoes a
                  WHERE ${indicacaoCasa({ cultura: f.cultura }, sql`a`)})`
          : sql`NULL`
      } AS alvos,
      ${viaTodasAsCulturas(f)} AS via_todas_as_culturas
    FROM agrofit_products p
    WHERE ${onde}
    -- Registro que nomeia a cultura vem antes do geral: são poucos e são os
    -- que o usuário procura; em ordem alfabética sumiriam entre centenas.
    -- Sem cultura não há o que separar (e ORDER BY false é erro no Postgres).
    ORDER BY ${f.cultura ? sql`${viaTodasAsCulturas(f)}, ` : sql``}p.product_name
    LIMIT ${tamanho} OFFSET ${(pagina - 1) * tamanho}
  `);

  return {
    total,
    pagina,
    tamanho,
    paginas: Math.max(1, Math.ceil(total / tamanho)),
    // O front só mostra a coluna de alvos quando há filtro de cultura;
    // sem ele, "alvos" seriam as centenas de pragas de todas as culturas.
    temAlvos: Boolean(f.cultura),
    viaTodasAsCulturas: Number(contagem?.[0]?.via_todas ?? 0),
    itens: rows ?? [],
  };
}

/**
 * Culturas de um produto, com os alvos registrados em cada uma.
 *
 * Sob demanda porque um produto pode cobrir mais de cem culturas: embutir isso
 * em cada linha da busca inflaria a listagem inteira para atender ao punhado de
 * produtos que o usuário realmente abre.
 */
export async function culturasDoProduto(registro: string) {
  const { rows } = await db.execute<{ cultura: string; alvos: string | null }>(sql`
    -- nullif nos dois campos: quando ambos são vazios a cultura está
    -- registrada sem alvo específico, e string_agg devolve NULL — o front
    -- diz isso em palavras em vez de mostrar uma cultura solta.
    SELECT cultura,
           string_agg(
             DISTINCT coalesce(nullif(praga_nome_comum, ''), nullif(praga_nome_cientifico, '')),
             ', ' ORDER BY coalesce(nullif(praga_nome_comum, ''), nullif(praga_nome_cientifico, ''))
           ) AS alvos
    FROM agrofit_indicacoes
    WHERE registration = ${registro}
    GROUP BY cultura
    ORDER BY cultura
  `);
  return rows ?? [];
}

/**
 * Listas canônicas do Agrofit, para autocompletar os filtros.
 *
 * Existe por um motivo de correção, não de conforto: a busca é ILIKE sobre o
 * nome exato, então "pitaia" ou "fruta-do-dragão" não acham a cultura que o
 * MAPA registra como "Pitaya" — e o usuário leria isso como "não há produto".
 */
export async function vocabulario() {
  const de = async (colecao: string, campo: string) => {
    const { rows } = await db.execute<{ nome: string }>(sql`
      SELECT DISTINCT payload->>${campo} AS nome
      FROM agrofit_itens
      WHERE colecao = ${colecao} AND payload->>${campo} IS NOT NULL
      ORDER BY 1
    `);
    return (rows ?? []).map((r) => r.nome);
  };

  const [culturas, classes, ingredientes, titulares, pragas] = await Promise.all([
    de("culturas", "nome"),
    de("classes-categorias-agronomicas", "nome"),
    de("ingredientes-ativos", "nome_comum"),
    de("titulares-registros", "nome"),
    de("pragas-nomes-comuns", "nome"),
  ]);

  return { culturas, classes, ingredientes, titulares, pragas };
}
