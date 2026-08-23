import { watch, type FSWatcher } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DIR_CONHECIMENTO, ingerirArquivo } from "./ingestao";

/**
 * Observa data/conhecimento/ e ingere o arquivo que mudou.
 *
 * Existe para que colocar um .md na pasta baste — sem lembrar do
 * `npm run db:seed`. Esquecer esse passo já fez um documento parecer
 * "não reconhecido pelo chat" quando na verdade nunca tinha entrado no banco.
 *
 * Só o arquivo alterado é reingerido, não a pasta inteira: com embeddings
 * ligados, reingerir tudo a cada salvamento gastaria crédito à toa.
 *
 * Não roda em produção — lá o sistema de arquivos costuma ser somente leitura
 * e o deploy é quem decide quando semear.
 */

const ESPERA_MS = 400;

let observador: FSWatcher | null = null;
const agendados = new Map<string, NodeJS.Timeout>();

async function ingerir(arquivo: string) {
  const caminho = join(DIR_CONHECIMENTO, arquivo);

  // O evento chega também quando o arquivo é apagado ou renomeado; nesse caso
  // o documento antigo continua no banco. Remover exigiria saber o título, que
  // só existe dentro do arquivo que acabou de sumir — `npm run db:seed` não
  // resolveria isso sozinho tampouco. Fica registrado como limitação.
  if (!existsSync(caminho)) {
    console.log(
      `[conhecimento] ${arquivo} sumiu da pasta. O documento continua na base — rode uma limpeza manual se ele não deve mais ser citado.`,
    );
    return;
  }

  try {
    const { titulo, chunks } = await ingerirArquivo(caminho);
    console.log(`[conhecimento] ${titulo} — ${chunks} trecho(s) atualizados.`);
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    console.error(`[conhecimento] falha ao ingerir ${arquivo}: ${motivo}`);
  }
}

export function observarConhecimento() {
  if (observador) return;
  if (!existsSync(DIR_CONHECIMENTO)) return;

  observador = watch(DIR_CONHECIMENTO, (_evento, arquivo) => {
    if (!arquivo || !arquivo.endsWith(".md")) return;

    // Editor de texto dispara vários eventos por salvamento (truncar, gravar,
    // renomear temporário). Sem o atraso, o mesmo arquivo seria ingerido três
    // ou quatro vezes por Ctrl+S.
    clearTimeout(agendados.get(arquivo));
    agendados.set(
      arquivo,
      setTimeout(() => {
        agendados.delete(arquivo);
        void ingerir(arquivo);
      }, ESPERA_MS),
    );
  });

  console.log(
    "[conhecimento] observando data/conhecimento — .md salvo aqui entra na base sozinho.",
  );
}
