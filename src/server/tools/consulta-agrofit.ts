import { sql } from "drizzle-orm";
import { db } from "../db";
import { buscarPagina, temCredencial, juntar } from "../agrofit/api";
import type { ProdutoFormulado } from "../agrofit/api";
import type { ToolDef } from "../llm/types";

/**
 * Produtos fitossanitários registrados no Mapa.
 *
 * A base local (populada por `npm run agrofit:sync`) é a fonte primária: é
 * completa, responde em milissegundos e não gasta cota. A API entra só quando
 * a base local ainda não foi sincronizada — aí um "nenhum resultado" local
 * não significa "não existe registro", e chutar isso seria pior que consultar.
 */
export const consultaAgrofit: ToolDef = {
  name: "consulta_agrofit",
  description:
    "Consulta produtos fitossanitários REGISTRADOS no MAPA (base Agrofit) para uma cultura e alvo (praga ou doença). " +
    "Use sempre que a pergunta envolver qual produto/defensivo/fungicida/inseticida aplicar. " +
    "Retorna nome comercial, ingrediente ativo, classe e número de registro. " +
    "NUNCA prescreva dose ou aplicação: informe o registro e lembre que a compra e aplicação exigem receituário agronômico.",
  parameters: {
    type: "object",
    properties: {
      cultura: {
        type: "string",
        description: "Cultura alvo. Para este produto normalmente 'pitaya'.",
      },
      alvo: {
        type: "string",
        description:
          "Praga ou doença (ex.: 'antracnose', 'mosca-das-frutas', 'podridão'). Opcional.",
      },
      ingrediente_ativo: {
        type: "string",
        description: "Filtrar por ingrediente ativo específico. Opcional.",
      },
    },
    required: ["cultura"],
  },

  async run(input) {
    const cultura = String(input.cultura ?? "pitaya");
    const alvo = input.alvo ? String(input.alvo) : null;
    const ativo = input.ingrediente_ativo ? String(input.ingrediente_ativo) : null;

    const base = await estadoDaBase();
    const local = await viaBaseLocal({ cultura, alvo, ativo }, base);
    if (local.encontrou || base.sincronizada || !temCredencial()) {
      return local.resposta;
    }

    try {
      return await viaApi({ cultura, alvo, ativo });
    } catch (err) {
      console.warn(
        "API Agrofit indisponível:",
        err instanceof Error ? err.message : err,
      );
      return local.resposta;
    }
  },
};

const RODAPE =
  "\n\nObrigatório informar ao usuário: esta lista indica apenas o REGISTRO no MAPA. " +
  "Dose, intervalo de segurança e modo de aplicação constam da bula, e a aquisição e " +
  "aplicação exigem receituário agronômico emitido por profissional habilitado.";

interface EstadoBase {
  /** A coleta de produtos-formulados terminou inteira, sem erro. */
  sincronizada: boolean;
  /** Data da coleta em YYYY-MM-DD — formatada no SQL, não é um Date. */
  em: string | null;
}

/**
 * Distingue "não existe registro" de "a base não foi carregada". Sem isso a
 * tool tem que hedgear todo resultado vazio, e o hedge apaga justamente a
 * informação que importa na pitaya: a de que realmente não há produto.
 */
async function estadoDaBase(): Promise<EstadoBase> {
  const { rows } = await db.execute<{
    sincronizada: boolean;
    em: string | null;
  }>(sql`
    SELECT (ultimo_erro IS NULL AND registros_gravados > 0) AS sincronizada,
           to_char(sincronizado_em, 'YYYY-MM-DD') AS em
    FROM agrofit_colecoes
    WHERE colecao = 'produtos-formulados'
  `);
  return {
    sincronizada: Boolean(rows?.[0]?.sincronizada),
    em: rows?.[0]?.em ?? null,
  };
}

async function viaBaseLocal(
  p: { cultura: string; alvo: string | null; ativo: string | null },
  base: EstadoBase,
) {
  // O join com agrofit_indicacoes casa cultura e praga na MESMA indicação de
  // uso. Cruzar as colunas agregadas de agrofit_products acharia produto
  // registrado para a praga em outra cultura — e isso é um erro grave aqui.
  const { rows } = await db.execute<{
    registration: string;
    product_name: string;
    active_ingredient: string | null;
    product_class: string | null;
    holder: string | null;
    toxicological_class: string | null;
    environmental_class: string | null;
    formulacao: string | null;
    modo_acao: string | null;
    produto_biologico: boolean | null;
    agricultura_organica: boolean | null;
    url_agrofit: string | null;
    alvos: string | null;
  }>(sql`
    SELECT p.registration, p.product_name, p.active_ingredient, p.product_class,
           p.holder, p.toxicological_class, p.environmental_class, p.formulacao,
           p.modo_acao, p.produto_biologico, p.agricultura_organica, p.url_agrofit,
           string_agg(
             DISTINCT coalesce(nullif(i.praga_nome_comum, ''), i.praga_nome_cientifico),
             ', '
           ) AS alvos
    FROM agrofit_products p
    JOIN agrofit_indicacoes i ON i.registration = p.registration
    WHERE i.cultura ILIKE ${"%" + p.cultura + "%"}
      ${
        p.alvo
          ? sql`AND (i.praga_nome_comum ILIKE ${"%" + p.alvo + "%"}
                     OR i.praga_nome_cientifico ILIKE ${"%" + p.alvo + "%"})`
          : sql``
      }
      ${p.ativo ? sql`AND p.active_ingredient ILIKE ${"%" + p.ativo + "%"}` : sql``}
    GROUP BY p.registration, p.product_name, p.active_ingredient, p.product_class,
             p.holder, p.toxicological_class, p.environmental_class, p.formulacao,
             p.modo_acao, p.produto_biologico, p.agricultura_organica, p.url_agrofit
    ORDER BY p.product_name
    LIMIT 40
  `);

  const lista = rows ?? [];
  const escopo = `cultura "${p.cultura}"` + (p.alvo ? ` / alvo "${p.alvo}"` : "");

  // Base vinda só do CSV dos Dados Abertos não tem indicação de uso
  // estruturada — o join acima devolve vazio sempre. Cair para as colunas
  // agregadas é pior (casa cultura e praga de indicações diferentes), então
  // só vale quando não há indicações nenhuma, e o texto avisa disso.
  if (lista.length === 0 && (await semIndicacoes())) {
    return viaColunasAgregadas(p, escopo);
  }

  if (lista.length === 0) {
    // Base completa: o vazio é resposta, não lacuna. Hedgear aqui faria o
    // agente sugerir "talvez exista" sobre um acervo que diz que não existe.
    const quando = base.em ?? "data desconhecida";
    const text = base.sincronizada
      ? `A base Agrofit está sincronizada (coleta de ${quando}, acervo completo do MAPA) e ` +
        `NÃO há nenhum produto registrado para ${escopo}. Isso é uma resposta firme, não ` +
        `falta de dado: afirme ao usuário que não existe registro para essa combinação. ` +
        `A pitaya é minor crop e tem pouquíssimos registros — explique que aplicar produto ` +
        `não registrado para a cultura é irregular, e que a saída legal passa por um ` +
        `agrônomo (extrapolação de uso / registro para minor crops).`
      : `Nenhum produto registrado encontrado na base Agrofit local para ${escopo}, mas a ` +
        `base ainda NÃO foi sincronizada (rode "npm run agrofit:sync"). Não afirme que não ` +
        `existe registro — diga que a consulta não pôde ser feita de forma confiável e ` +
        `sugira conferir em https://agrofit.agricultura.gov.br ou com um agrônomo.`;

    return {
      encontrou: false,
      resposta: {
        text,
        sources: [
          {
            tool: "consulta_agrofit",
            label: base.sincronizada
              ? `Base Agrofit — API AgroAPI/Embrapa (MAPA), coleta de ${quando} — sem registro`
              : "Base Agrofit local — não sincronizada",
            detail: escopo,
          },
        ],
      },
    };
  }

  const linhas = lista.map((r) => {
    const marcas: string[] = [];
    if (r.produto_biologico) marcas.push("biológico");
    if (r.agricultura_organica) marcas.push("aprovado p/ agricultura orgânica");

    return (
      `• ${r.product_name} — i.a.: ${r.active_ingredient ?? "n/d"} | classe: ${
        r.product_class ?? "n/d"
      } | registro MAPA: ${r.registration} | titular: ${r.holder ?? "n/d"}` +
      ` | formulação: ${r.formulacao ?? "n/d"} | class. toxicológica: ${
        r.toxicological_class ?? "n/d"
      } | class. ambiental: ${r.environmental_class ?? "n/d"}` +
      (marcas.length ? ` | ${marcas.join(", ")}` : "") +
      (r.modo_acao ? `\n   modo de ação: ${r.modo_acao}` : "") +
      (r.alvos ? `\n   alvos nesta cultura: ${r.alvos.slice(0, 300)}` : "") +
      (r.url_agrofit ? `\n   ficha: ${r.url_agrofit}` : "")
    );
  });

  return {
    encontrou: true,
    resposta: {
      text: `${lista.length} produto(s) registrado(s) para ${escopo}:\n${linhas.join("\n")}${RODAPE}`,
      sources: [
        {
          tool: "consulta_agrofit",
          label: "Base Agrofit — API AgroAPI/Embrapa (MAPA), cópia local",
          detail: `${lista.length} registro(s) para ${p.cultura}`,
        },
      ],
    },
  };
}

async function semIndicacoes(): Promise<boolean> {
  const { rows } = await db.execute<{ existe: boolean }>(sql`
    SELECT NOT EXISTS (SELECT 1 FROM agrofit_indicacoes) AS existe
  `);
  return Boolean(rows?.[0]?.existe);
}

/**
 * Caminho degradado para a base importada do CSV: cruza as colunas de texto
 * agregadas de agrofit_products. Casa cultura e praga que podem vir de
 * indicações de uso diferentes — por isso a resposta declara a imprecisão.
 */
async function viaColunasAgregadas(
  p: { cultura: string; alvo: string | null; ativo: string | null },
  escopo: string,
) {
  const { rows } = await db.execute<{
    registration: string | null;
    product_name: string;
    active_ingredient: string | null;
    product_class: string | null;
    holder: string | null;
    toxicological_class: string | null;
    pests: string | null;
  }>(sql`
    SELECT registration, product_name, active_ingredient, product_class,
           holder, toxicological_class, pests
    FROM agrofit_products
    WHERE crops ILIKE ${"%" + p.cultura + "%"}
      ${p.alvo ? sql`AND pests ILIKE ${"%" + p.alvo + "%"}` : sql``}
      ${p.ativo ? sql`AND active_ingredient ILIKE ${"%" + p.ativo + "%"}` : sql``}
    ORDER BY product_name
    LIMIT 40
  `);

  const lista = rows ?? [];
  if (lista.length === 0) {
    return {
      encontrou: false,
      resposta: {
        text:
          `Nenhum produto encontrado no cache local (Dados Abertos) para ${escopo}. ` +
          `Pode não haver registro para essa combinação — comum na pitaya — ou o cache ` +
          `pode estar incompleto. Rode "npm run agrofit:sync" para trazer a base completa ` +
          `da API. Informe a ambiguidade ao usuário.`,
        sources: [
          {
            tool: "consulta_agrofit",
            label: "Dados Abertos Agrofit (cache local) — sem resultados",
            detail: escopo,
          },
        ],
      },
    };
  }

  const linhas = lista.map(
    (r) =>
      `• ${r.product_name} — i.a.: ${r.active_ingredient ?? "n/d"} | classe: ${
        r.product_class ?? "n/d"
      } | registro MAPA: ${r.registration ?? "n/d"} | titular: ${
        r.holder ?? "n/d"
      } | class. toxicológica: ${r.toxicological_class ?? "n/d"}` +
      (r.pests ? `\n   alvos do produto: ${r.pests.slice(0, 200)}` : ""),
  );

  return {
    encontrou: true,
    resposta: {
      text:
        `${lista.length} produto(s) para ${escopo}, vindos do cache dos Dados Abertos:\n` +
        `${linhas.join("\n")}\n\nATENÇÃO — avise o usuário: esta base não traz a indicação ` +
        `de uso estruturada, então a cultura e o alvo foram casados em campos separados e ` +
        `podem vir de indicações diferentes. Confirme cada produto na bula ou em ` +
        `https://agrofit.agricultura.gov.br antes de considerar registrado para esta ` +
        `cultura.${RODAPE}`,
      sources: [
        {
          tool: "consulta_agrofit",
          label: "Dados Abertos Agrofit — MAPA (cache local, cruzamento aproximado)",
          detail: `${lista.length} registro(s) para ${p.cultura}`,
        },
      ],
    },
  };
}

/**
 * Busca ao vivo. O endpoint com filtro é /search/produtos-formulados —
 * /produtos-formulados só pagina o acervo inteiro e ignora qualquer filtro.
 */
async function viaApi(p: {
  cultura: string;
  alvo: string | null;
  ativo: string | null;
}) {
  const params: Record<string, string> = { cultura: p.cultura };
  if (p.alvo) params.praga_nome_comum = p.alvo;
  if (p.ativo) params.ingrediente_ativo = p.ativo;

  const pagina = await buscarPagina<ProdutoFormulado>(
    "/search/produtos-formulados",
    params,
  );
  const escopo = `cultura "${p.cultura}"` + (p.alvo ? ` / alvo "${p.alvo}"` : "");

  if (pagina.itens.length === 0) {
    return {
      text:
        `A API Agrofit não retornou nenhum produto registrado para ${escopo}. ` +
        `Na pitaya isso é o esperado: a cultura tem pouquíssimo registro no Mapa. ` +
        `Informe a ausência ao usuário e sugira consultar um agrônomo sobre minor crops.`,
      sources: [
        {
          tool: "consulta_agrofit",
          label: "API Agrofit — Embrapa/MAPA (sem resultados)",
          detail: escopo,
        },
      ],
    };
  }

  const linhas = pagina.itens.slice(0, 40).map((it) => {
    const alvos = [
      ...new Set(
        (it.indicacao_uso ?? [])
          .filter((i) => i.cultura?.toLowerCase().includes(p.cultura.toLowerCase()))
          .flatMap((i) => i.praga_nome_comum ?? []),
      ),
    ];
    return (
      `• ${juntar(it.marca_comercial) || it.numero_registro} — i.a.: ${
        juntar(it.ingrediente_ativo) || "n/d"
      } | classe: ${juntar(it.classe_categoria_agronomica) || "n/d"} | registro MAPA: ${
        it.numero_registro ?? "n/d"
      } | titular: ${it.titular_registro ?? "n/d"} | class. toxicológica: ${
        it.classificacao_toxicologica ?? "n/d"
      }` + (alvos.length ? `\n   alvos nesta cultura: ${alvos.join(", ")}` : "")
    );
  });

  return {
    text:
      `${pagina.totalRegistros} produto(s) registrado(s) para ${escopo} ` +
      `(mostrando ${linhas.length}):\n${linhas.join("\n")}${RODAPE}`,
    sources: [
      {
        tool: "consulta_agrofit",
        label: "API Agrofit — Embrapa/MAPA",
        detail: `${pagina.totalRegistros} registro(s) para ${p.cultura}`,
      },
    ],
  };
}
