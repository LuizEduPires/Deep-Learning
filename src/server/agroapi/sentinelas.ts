/**
 * Limpeza dos sentinelas que a base do MAPA usa no lugar de "vazio".
 *
 * Vale para Agrofit e Bioinsumos: as duas APIs servem o mesmo cadastro, com os
 * mesmos preenchimentos de placeholder.
 */

/** Sentinela da API para "sem nome comum cadastrado" — não é nome de praga. */
const SEM_NOME = /^ausente$/i;
/** Descarta preenchimentos de placeholder: "-", ".", ",", "--", "=". */
const TEM_LETRA = /\p{L}/u;

/** Achata valor ou lista em texto legível. */
export const juntar = (v: unknown): string =>
  Array.isArray(v) ? v.map(juntar).join(" | ") : v == null ? "" : String(v);

/** Normaliza um campo de nomes para lista limpa, descartando os sentinelas. */
export function nomesComuns(valor: unknown): string[] {
  const lista = Array.isArray(valor) ? valor : valor == null ? [] : [valor];
  return lista
    .map((v) => String(v).trim())
    .filter((s) => TEM_LETRA.test(s) && !SEM_NOME.test(s));
}

/**
 * Mesma limpeza para um valor único — praga_nome_cientifico também vem como
 * "Ausente". A linha continua valendo: significa cultura registrada sem alvo
 * específico, não indicação inválida.
 */
export function nomeLimpo(valor: unknown): string {
  return nomesComuns(valor)[0] ?? "";
}
