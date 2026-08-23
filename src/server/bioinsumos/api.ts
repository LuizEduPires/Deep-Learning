/**
 * Cliente da API Bioinsumos (AgroAPI/Embrapa) — o recorte biológico do mesmo
 * cadastro do MAPA, em duas categorias: produtos biológicos para controle de
 * pragas e inoculantes.
 *
 * Este arquivo só serve à coleta (scripts/bioinsumos-sync.ts): o catálogo de
 * coleções, a paginação e os tipos do payload. Quem consulta é
 * `busca.ts`, contra a cópia no Postgres — a aplicação não fala com a Embrapa
 * em tempo de request.
 */

import { paginar } from "../agroapi/http";
import type { IndicacaoUso, IngredienteAtivoDetalhado } from "../agrofit/api";

export { temCredencial } from "../agroapi/token";

/** Prefixo desta API no gateway. Só a v2 é assinável; a v1 responde 403. */
const API = "bioinsumos/v2";

/**
 * Valor que o MAPA usa para registro sem cultura específica. 795 dos 834
 * produtos biológicos estão aqui — filtrar por uma cultura sem somar estes
 * devolveria quase nada e daria a impressão errada de que não há registro.
 */
export const TODAS_AS_CULTURAS = "Todas as culturas";

/** Percorre uma coleção desta API, página a página. Usado por bioinsumos-sync. */
export function paginarColecao<T>(
  caminho: string,
  opcoes: {
    params?: Record<string, string | number>;
    pausaMs?: number;
    aoIniciar?: (total: number, paginas: number) => void;
  } = {},
) {
  return paginar<T>(API, caminho, opcoes);
}

export interface Colecao {
  /** Nome usado no banco e na linha de comando. */
  nome: string;
  caminho: string;
  /** Identidade do item dentro da coleção — vira a PK em bioinsumos_itens. */
  chave: (item: Record<string, unknown>) => string;
}

const texto = (v: unknown): string =>
  Array.isArray(v) ? v.map(texto).join(" | ") : v == null ? "" : String(v);

const porCampo =
  (...campos: string[]) =>
  (item: Record<string, unknown>): string => {
    const valor = campos
      .map((c) => texto(item[c]))
      .filter(Boolean)
      .join("::");
    // Sem campo de identidade, o próprio payload identifica o item — pior
    // para ler, mas nunca sobrescreve um registro diferente.
    return valor || JSON.stringify(item);
  };

/**
 * As 12 coleções listáveis, mais /versao. Ficam de fora /health (sem corpo) e
 * /search/* (são filtros sobre estas mesmas coleções).
 *
 * `inoculantes` usa registro + cultura + espécie: a coleção traz uma linha por
 * produto × cultura, então `registro_produto` sozinho não identifica a linha.
 */
export const COLECOES: Colecao[] = [
  { nome: "produtos-biologicos", caminho: "/produtos-biologicos", chave: porCampo("numero_registro") },
  { nome: "inoculantes", caminho: "/inoculantes", chave: porCampo("registro_produto", "cultura", "especie") },
  { nome: "pragas", caminho: "/pragas", chave: porCampo("nome_cientifico") },
  { nome: "pragas-nomes-comuns", caminho: "/pragas-nomes-comuns", chave: porCampo("nome") },
  { nome: "pragas-nomes-cientificos", caminho: "/pragas-nomes-cientificos", chave: porCampo("nome") },
  { nome: "culturas", caminho: "/culturas", chave: porCampo("nome") },
  { nome: "ingredientes-ativos", caminho: "/ingredientes-ativos", chave: porCampo("nome_comum", "grupo_quimico") },
  { nome: "marcas-comerciais", caminho: "/marcas-comerciais", chave: porCampo("nome") },
  { nome: "titulares-registros", caminho: "/titulares-registros", chave: porCampo("nome") },
  { nome: "formulacoes", caminho: "/formulacoes", chave: porCampo("nome") },
  { nome: "modos-acoes", caminho: "/modos-acoes", chave: porCampo("nome") },
  { nome: "tecnicas-aplicacoes", caminho: "/tecnicas-aplicacoes", chave: porCampo("nome") },
  // Uma linha por publicação, virando histórico das datas de atualização.
  {
    nome: "versao",
    caminho: "/versao",
    chave: porCampo(
      "data_ultima_atualizacao_produtos_biologicos",
      "data_ultima_atualizacao_inoculantes",
    ),
  },
];

// -------------------------------------------------------------------- tipos

export interface ProdutoBiologico {
  numero_registro?: string;
  marca_comercial?: string[];
  titular_registro?: string;
  produto_biologico?: boolean;
  classe_categoria_agronomica?: string[];
  formulacao?: string;
  ingrediente_ativo?: string[];
  ingrediente_ativo_detalhado?: IngredienteAtivoDetalhado[];
  modo_acao?: string[];
  tecnica_aplicacao?: string[];
  indicacao_uso?: IndicacaoUso[];
  classificacao_toxicologica?: string;
  classificacao_ambiental?: string;
  inflamavel?: boolean;
  corrosivo?: boolean;
  produto_agricultura_organica?: boolean;
  url_agrofit?: string;
}

/**
 * Uma linha por produto × cultura: os 1.032 inoculantes registrados viram
 * 1.239 linhas. `registro_produto` não é único na coleção.
 */
export interface Inoculante {
  uf?: string;
  razao_social?: string;
  registro_produto?: string;
  atividade?: string;
  tipo?: string;
  especie?: string[];
  data_registro?: string;
  garantia?: string;
  natureza_fisica?: string;
  cultura?: string;
  cultura_nome_cientifico?: string;
}

export interface Versao {
  total_produtos_biologicos?: number;
  total_inoculantes?: number;
  data_ultima_atualizacao_produtos_biologicos?: string;
  data_ultima_atualizacao_inoculantes?: string;
  fonte?: string;
}

