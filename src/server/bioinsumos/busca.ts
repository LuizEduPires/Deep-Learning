import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";

/**
 * Busca estruturada na cópia local da base Bioinsumos (ver
 * scripts/bioinsumos-sync.ts). Consulta direta ao Postgres, sem LLM e sem
 * chamar a Embrapa: determinística, instantânea e imune à API estar fora.
 *
 * Exige `npm run bioinsumos:sync` ao menos uma vez. Quando a base está vazia,
 * as funções devolvem `baseVazia: true` em vez de zero resultados — "não
 * coletado" e "não existe registro" são respostas diferentes, e confundir as
 * duas faria o usuário concluir que não há bioinsumo para a cultura dele.
 *
 * A comparação é `unaccent` + `ILIKE`: mesma tolerância a acento que a busca
 * em memória tinha, para que trocar a fonte não mudasse o que o usuário acha.
 */

const como = (v: string) => `%${v}%`;

/** unaccent nos dois lados: "acao" acha "ação", "Feijao" acha "Feijão". */
const semAcento = (coluna: SQL, valor: string): SQL =>
  sql`unaccent(${coluna}) ILIKE unaccent(${como(valor)})`;

export interface FiltrosProduto {
  q?: string;
  cultura?: string;
  praga?: string;
  ingrediente?: string;
  titular?: string;
  classe?: string;
  organico?: boolean;
}

export interface FiltrosInoculante {
  q?: string;
  cultura?: string;
  especie?: string;
  uf?: string;
  tipo?: string;
}

// ------------------------------------------------------------------ indicações

/**
 * Condição sobre uma linha de bioinsumos_indicacoes.
 *
 * As duas regras do domínio moram aqui:
 *
 * 1. Cultura e praga precisam casar na MESMA linha — ou seja, na mesma
 *    indicação de uso. Cruzá-las em campos agregados acharia produto
 *    registrado para a praga em *outra* cultura.
 * 2. `todas_as_culturas` conta como registro válido para a cultura filtrada.
 *    2.950 das 3.172 indicações são genéricas; sem isso, "Pitaya" devolveria
 *    zero quando 795 dos 834 produtos valem para ela.
 */
function condicaoIndicacao(
  f: Pick<FiltrosProduto, "cultura" | "praga">,
  aliasIndicacao = sql`i`,
  /** true = exige que a cultura esteja nomeada, sem aceitar o registro geral. */
  somenteNominal = false,
): SQL {
  const cond: SQL[] = [];

  if (f.cultura) {
    const nomeada = semAcento(sql`${aliasIndicacao}.cultura`, f.cultura);
    cond.push(
      somenteNominal
        ? sql`(${nomeada} AND NOT ${aliasIndicacao}.todas_as_culturas)`
        : sql`(${nomeada} OR ${aliasIndicacao}.todas_as_culturas)`,
    );
  }
  if (f.praga) {
    cond.push(
      sql`(${semAcento(sql`${aliasIndicacao}.praga_nome_comum`, f.praga)}
           OR ${semAcento(sql`${aliasIndicacao}.praga_nome_cientifico`, f.praga)})`,
    );
  }

  return cond.length ? sql.join(cond, sql` AND `) : sql`true`;
}

function condicoesProduto(f: FiltrosProduto): SQL {
  const cond: SQL[] = [sql`true`];

  if (f.q) {
    cond.push(
      sql`(${semAcento(sql`p.marca_comercial`, f.q)} OR p.numero_registro ILIKE ${como(f.q)})`,
    );
  }
  if (f.ingrediente) cond.push(semAcento(sql`p.ingrediente_ativo`, f.ingrediente));
  if (f.titular) cond.push(semAcento(sql`p.titular_registro`, f.titular));
  if (f.classe) cond.push(semAcento(sql`p.classe_categoria`, f.classe));
  if (f.organico) cond.push(sql`p.agricultura_organica IS TRUE`);

  if (f.cultura || f.praga) {
    // EXISTS, não JOIN: o JOIN duplicaria o produto uma vez por indicação que
    // casasse, quebrando a paginação e a contagem total.
    cond.push(sql`EXISTS (
      SELECT 1 FROM bioinsumos_indicacoes i
       WHERE i.numero_registro = p.numero_registro
         AND ${condicaoIndicacao(f)}
    )`);
  }

  return sql.join(cond, sql` AND `);
}

// ------------------------------------------------------------------- produtos

export async function buscarProdutos(
  f: FiltrosProduto,
  pagina: number,
  tamanho: number,
) {
  const onde = condicoesProduto(f);
  const temAlvos = Boolean(f.cultura || f.praga);

  const { rows: contagem } = await db.execute<{ total: string; via_todas: string }>(sql`
    SELECT
      count(*) AS total,
      -- Casou só pelo registro geral: nenhuma indicação nomeia a cultura.
      count(*) FILTER (
        WHERE ${
          f.cultura
            ? sql`NOT EXISTS (
                  SELECT 1 FROM bioinsumos_indicacoes i
                   WHERE i.numero_registro = p.numero_registro
                     AND ${condicaoIndicacao(f, sql`i`, true)}
                )`
            : sql`false`
        }
      ) AS via_todas
    FROM bioinsumos_produtos p
    WHERE ${onde}
  `);

  const total = Number(contagem?.[0]?.total ?? 0);
  const viaTodasAsCulturas = Number(contagem?.[0]?.via_todas ?? 0);

  const { rows } = await db.execute(sql`
    SELECT
      p.numero_registro,
      p.marca_comercial AS nome,
      p.ingrediente_ativo,
      p.classe_categoria AS classe,
      p.titular_registro AS titular,
      p.formulacao,
      p.modo_acao,
      p.tecnica_aplicacao,
      p.classificacao_toxicologica AS toxicologica,
      p.classificacao_ambiental AS ambiental,
      coalesce(p.agricultura_organica, false) AS organico,
      p.url_agrofit,
      (SELECT count(DISTINCT c.cultura)::int
         FROM bioinsumos_indicacoes c
        WHERE c.numero_registro = p.numero_registro) AS n_culturas,
      ${
        temAlvos
          ? sql`(SELECT string_agg(
                   DISTINCT coalesce(nullif(a.praga_nome_comum, ''), nullif(a.praga_nome_cientifico, '')),
                   ', ' ORDER BY coalesce(nullif(a.praga_nome_comum, ''), nullif(a.praga_nome_cientifico, ''))
                 )
                   FROM bioinsumos_indicacoes a
                  WHERE a.numero_registro = p.numero_registro
                    AND ${condicaoIndicacao(f, sql`a`)})`
          : sql`NULL`
      } AS alvos,
      ${
        f.cultura
          ? sql`NOT EXISTS (
                SELECT 1 FROM bioinsumos_indicacoes n
                 WHERE n.numero_registro = p.numero_registro
                   AND ${condicaoIndicacao(f, sql`n`, true)}
              )`
          : sql`false`
      } AS via_todas_as_culturas
    FROM bioinsumos_produtos p
    WHERE ${onde}
    ORDER BY p.marca_comercial
    LIMIT ${tamanho} OFFSET ${(pagina - 1) * tamanho}
  `);

  return {
    aba: "produtos" as const,
    ...paginacao(total, pagina, tamanho),
    atualizadoEm: await dataDaBase("produtos_biologicos"),
    baseVazia: total === 0 && (await vazia("bioinsumos_produtos")),
    // A coluna de alvos só faz sentido com filtro de cultura ou praga; sem
    // eles seriam as centenas de pragas de todas as culturas do produto.
    temAlvos,
    viaTodasAsCulturas,
    itens: rows ?? [],
  };
}

// ---------------------------------------------------------------- inoculantes

export async function buscarInoculantes(
  f: FiltrosInoculante,
  pagina: number,
  tamanho: number,
) {
  const cond: SQL[] = [sql`true`];

  if (f.q) {
    cond.push(
      sql`(i.registro_produto ILIKE ${como(f.q)} OR ${semAcento(sql`i.razao_social`, f.q)})`,
    );
  }
  if (f.cultura) cond.push(semAcento(sql`i.cultura`, f.cultura));
  if (f.especie) cond.push(semAcento(sql`i.especie`, f.especie));
  if (f.tipo) cond.push(semAcento(sql`i.tipo`, f.tipo));
  // UF é sigla de duas letras: comparação exata, não substring.
  if (f.uf) cond.push(sql`upper(i.uf) = upper(${f.uf})`);

  const onde = sql.join(cond, sql` AND `);

  const { rows: contagem } = await db.execute<{ total: string }>(sql`
    SELECT count(*) AS total FROM bioinsumos_inoculantes i WHERE ${onde}
  `);
  const total = Number(contagem?.[0]?.total ?? 0);

  const { rows } = await db.execute(sql`
    SELECT
      i.registro_produto, i.razao_social, i.uf, i.atividade, i.tipo, i.especie,
      i.cultura, i.cultura_nome_cientifico, i.garantia, i.natureza_fisica,
      to_char(i.data_registro, 'YYYY-MM-DD') AS data_registro
    FROM bioinsumos_inoculantes i
    WHERE ${onde}
    ORDER BY i.razao_social, i.registro_produto
    LIMIT ${tamanho} OFFSET ${(pagina - 1) * tamanho}
  `);

  return {
    aba: "inoculantes" as const,
    ...paginacao(total, pagina, tamanho),
    atualizadoEm: await dataDaBase("inoculantes"),
    baseVazia: total === 0 && (await vazia("bioinsumos_inoculantes")),
    itens: rows ?? [],
  };
}

// ---------------------------------------------------------------- vocabulário

/**
 * Listas canônicas para autocompletar os filtros.
 *
 * Culturas, pragas, ingredientes e titulares saem das coleções de vocabulário
 * que a coleta gravou; classe, espécie, UF e tipo são derivadas dos registros,
 * porque a API não tem endpoint para elas.
 *
 * Culturas vem do vocabulário e não dos produtos de propósito: "Pitaya" tem
 * zero produto próprio e sumiria da lista — justo a cultura que este projeto
 * consulta, e que casa via "Todas as culturas".
 */
export async function vocabulario() {
  const doVocabulario = async (colecao: string, campo: string) => {
    const { rows } = await db.execute<{ nome: string }>(sql`
      SELECT DISTINCT payload->>${campo} AS nome
        FROM bioinsumos_itens
       WHERE colecao = ${colecao} AND nullif(trim(payload->>${campo}), '') IS NOT NULL
       ORDER BY 1
    `);
    return (rows ?? []).map((r) => r.nome);
  };

  /** Campo array no payload: explode em valores distintos. */
  const doArray = async (tabela: SQL, campo: string) => {
    const { rows } = await db.execute<{ nome: string }>(sql`
      SELECT DISTINCT valor AS nome
        FROM ${tabela}, jsonb_array_elements_text(payload->${campo}) AS valor
       WHERE jsonb_typeof(payload->${campo}) = 'array'
         AND nullif(trim(valor), '') IS NOT NULL
       ORDER BY 1
    `);
    return (rows ?? []).map((r) => r.nome);
  };

  const daColuna = async (coluna: SQL) => {
    const { rows } = await db.execute<{ nome: string }>(sql`
      SELECT DISTINCT ${coluna} AS nome
        FROM bioinsumos_inoculantes
       WHERE nullif(trim(${coluna}), '') IS NOT NULL
       ORDER BY 1
    `);
    return (rows ?? []).map((r) => r.nome);
  };

  const [culturas, pragas, ingredientes, titulares, classes, especies, ufs, tipos] =
    await Promise.all([
      doVocabulario("culturas", "nome"),
      doVocabulario("pragas-nomes-comuns", "nome"),
      doVocabulario("ingredientes-ativos", "nome_comum"),
      doVocabulario("titulares-registros", "nome"),
      doArray(sql`bioinsumos_produtos`, "classe_categoria_agronomica"),
      doArray(sql`bioinsumos_inoculantes`, "especie"),
      daColuna(sql`uf`),
      daColuna(sql`tipo`),
    ]);

  return {
    culturas,
    pragas,
    ingredientes,
    titulares,
    classes,
    especies,
    ufs,
    tipos,
    versao: await versao(),
  };
}

/**
 * Culturas de um produto, com os alvos de cada uma. Devolve `null` quando o
 * registro não existe, para a rota responder 404.
 */
export async function culturasDoProduto(registro: string) {
  const { rows: existe } = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM bioinsumos_produtos WHERE numero_registro = ${registro}
  `);
  if (!existe?.[0]?.n) return null;

  const { rows } = await db.execute<{ cultura: string; alvos: string | null }>(sql`
    -- nullif nos dois campos: quando ambos são vazios a cultura está
    -- registrada sem alvo específico, e string_agg devolve NULL — o front diz
    -- isso em palavras em vez de mostrar uma cultura solta.
    SELECT cultura,
           string_agg(
             DISTINCT coalesce(nullif(praga_nome_comum, ''), nullif(praga_nome_cientifico, '')),
             ', ' ORDER BY coalesce(nullif(praga_nome_comum, ''), nullif(praga_nome_cientifico, ''))
           ) AS alvos
      FROM bioinsumos_indicacoes
     WHERE numero_registro = ${registro}
     GROUP BY cultura
     ORDER BY cultura
  `);
  return rows ?? [];
}

// ---------------------------------------------------------------- auxiliares

function paginacao(total: number, pagina: number, tamanho: number) {
  return { total, pagina, tamanho, paginas: Math.max(1, Math.ceil(total / tamanho)) };
}

/** Tabela sem nenhuma linha = coleta nunca rodou. */
async function vazia(tabela: "bioinsumos_produtos" | "bioinsumos_inoculantes") {
  const { rows } = await db.execute<{ n: number }>(
    tabela === "bioinsumos_produtos"
      ? sql`SELECT count(*)::int AS n FROM bioinsumos_produtos`
      : sql`SELECT count(*)::int AS n FROM bioinsumos_inoculantes`,
  );
  return (rows?.[0]?.n ?? 0) === 0;
}

/** O payload de /versao gravado pela coleta — a data de publicação do MAPA. */
async function versao() {
  const { rows } = await db.execute<{ payload: Record<string, unknown> }>(sql`
    SELECT payload FROM bioinsumos_itens
     WHERE colecao = 'versao'
     ORDER BY sincronizado_em DESC
     LIMIT 1
  `);
  return rows?.[0]?.payload ?? null;
}

async function dataDaBase(qual: "produtos_biologicos" | "inoculantes") {
  const v = (await versao()) as Record<string, string> | null;
  return v?.[`data_ultima_atualizacao_${qual}`] ?? null;
}
