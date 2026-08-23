/**
 * Cliente da API Agrofit (AgroAPI/Embrapa — gateway WSO2).
 *
 * Credencial e paginação são as do gateway, compartilhadas com as demais APIs
 * do portal — ver src/server/agroapi. Aqui fica só o que é do Agrofit: o prefixo
 * da API, o catálogo de coleções e os tipos.
 */

import {
  buscarPagina as buscarPaginaAgroApi,
  paginar as paginarAgroApi,
  type Pagina,
} from "../agroapi/http";
import { juntar as texto } from "../agroapi/sentinelas";

export { temCredencial } from "../agroapi/token";
export { juntar, nomesComuns, nomeLimpo } from "../agroapi/sentinelas";
export type { Pagina };

/** Prefixo desta API no gateway. */
const API = "agrofit/v1";

// -------------------------------------------------------------------- fetch

/** Uma página de uma coleção do Agrofit. */
export function buscarPagina<T>(
  caminho: string,
  params: Record<string, string | number> = {},
  tentativas = 5,
): Promise<Pagina<T>> {
  return buscarPaginaAgroApi<T>(API, caminho, params, tentativas);
}

/** Percorre uma coleção inteira do Agrofit, página a página. */
export function paginar<T>(
  caminho: string,
  opcoes: {
    params?: Record<string, string | number>;
    pausaMs?: number;
    aoIniciar?: (total: number, paginas: number) => void;
  } = {},
): AsyncGenerator<Pagina<T>> {
  return paginarAgroApi<T>(API, caminho, opcoes);
}

// ----------------------------------------------------------------- catálogo

export interface Colecao {
  /** Nome usado no banco e na linha de comando. */
  nome: string;
  caminho: string;
  /** Identidade do item dentro da coleção — vira a PK em agrofit_itens. */
  chave: (item: Record<string, unknown>) => string;
}

const porCampo =
  (...campos: string[]) =>
  (item: Record<string, unknown>): string => {
    const valor = campos
      .map((c) => texto(item[c]))
      .filter(Boolean)
      .join("::");
    // Sem campo de identidade, o próprio payload identifica o item —
    // pior para ler, mas nunca sobrescreve um registro diferente.
    return valor || JSON.stringify(item);
  };

/**
 * Id numérico embutido em url_agrofit (…?p_id_planta_daninha=1026). É a chave
 * primária real do sistema Agrofit: coleções como plantas-daninhas e
 * ingredientes-ativos repetem o nome científico em registros distintos, e só
 * esse id os separa. Cai para os campos de nome quando não há URL.
 */
const porUrlId =
  (...camposFallback: string[]) =>
  (item: Record<string, unknown>): string => {
    const url = texto(item.url_agrofit);
    const id = url.match(/p_id_[a-z_]+=(\d+)/i)?.[1];
    return id ? `id:${id}` : porCampo(...camposFallback)(item);
  };

/**
 * Hash curto e determinístico do payload. Usado só para desempatar registros
 * que compartilham a chave natural — ver scripts/agrofit-sync.ts.
 */
export function hashCurto(valor: unknown): string {
  const s = JSON.stringify(valor);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * As 18 coleções listáveis da API. Ficam de fora /health, /versao (guardada à
 * parte) e /search/* (são filtros sobre estas mesmas coleções).
 */
export const COLECOES: Colecao[] = [
  { nome: "produtos-formulados", caminho: "/produtos-formulados", chave: porCampo("numero_registro") },
  { nome: "produtos-tecnicos", caminho: "/produtos-tecnicos", chave: porCampo("numero_registro") },
  { nome: "pragas", caminho: "/pragas", chave: porCampo("nome_cientifico") },
  { nome: "pragas-nomes-comuns", caminho: "/pragas-nomes-comuns", chave: porCampo("nome") },
  { nome: "pragas-nomes-cientificos", caminho: "/pragas-nomes-cientificos", chave: porCampo("nome") },
  { nome: "plantas-daninhas", caminho: "/plantas-daninhas", chave: porUrlId("nome_cientifico") },
  { nome: "plantas-daninhas-nomes-comuns", caminho: "/plantas-daninhas-nomes-comuns", chave: porCampo("nome") },
  { nome: "culturas", caminho: "/culturas", chave: porCampo("nome") },
  { nome: "ingredientes-ativos", caminho: "/ingredientes-ativos", chave: porUrlId("nome_comum", "grupo_quimico") },
  { nome: "marcas-comerciais", caminho: "/marcas-comerciais", chave: porCampo("nome") },
  { nome: "titulares-registros", caminho: "/titulares-registros", chave: porCampo("nome") },
  { nome: "modos-acoes", caminho: "/modos-acoes", chave: porCampo("nome") },
  { nome: "tecnicas-aplicacoes", caminho: "/tecnicas-aplicacoes", chave: porCampo("nome") },
  { nome: "formulacoes", caminho: "/formulacoes", chave: porCampo("nome") },
  { nome: "classes-categorias-agronomicas", caminho: "/classes-categorias-agronomicas", chave: porCampo("nome") },
  { nome: "classificacoes-toxicologicas", caminho: "/classificacoes-toxicologicas", chave: porCampo("nome") },
  { nome: "classificacoes-ambientais", caminho: "/classificacoes-ambientais", chave: porCampo("nome") },
  // O payload real traz data_ultima_atualizacao — não o `id`/`ultima_publicacao`
  // que o OpenAPI declara. Uma linha por publicação, virando histórico.
  { nome: "versao", caminho: "/versao", chave: porCampo("data_ultima_atualizacao") },
];

// -------------------------------------------------------------------- tipos

export interface IngredienteAtivoDetalhado {
  ingrediente_ativo?: string;
  grupo_quimico?: string;
  concentracao?: string;
  unidade_medida?: string;
  percentual?: string;
}

export interface IndicacaoUso {
  cultura?: string;
  praga_nome_cientifico?: string;
  /**
   * O OpenAPI declara array, mas a API devolve a string "Ausente" quando a
   * praga não tem nome comum cadastrado. Normalize com `nomesComuns()`.
   */
  praga_nome_comum?: string[] | string;
}

export interface DocumentoCadastrado {
  descricao?: string;
  tipo_documento?: string;
  data_inclusao?: string;
  url?: string;
  origem?: string;
}

export interface ProdutoFormulado {
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
  documento_cadastrado?: DocumentoCadastrado[];
  produto_agricultura_organica?: boolean;
  url_agrofit?: string;
}
