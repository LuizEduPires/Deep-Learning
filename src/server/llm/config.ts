import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  CATALOGO,
  ehProvedorValido,
  provedorDoCatalogo,
  type NomeProvedor,
} from "./catalogo";

const CHAVE = "llm";

export type ConfigLlm = {
  provider: NomeProvedor;
  model: string;
  /** De onde veio o que está valendo agora. */
  origem: "painel" | "env";
  /** Preenchido quando o .env tem um valor que não dá para usar. */
  aviso?: string;
};

/** Provedor e modelo do .env — o padrão quando o painel nunca foi usado. */
function configDoEnv(): ConfigLlm {
  const bruto = (process.env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();
  const valido = ehProvedorValido(bruto);
  const provider: NomeProvedor = valido ? bruto : "anthropic";
  const model =
    process.env.LLM_MODEL?.trim() || provedorDoCatalogo(provider)!.modeloPadrao;

  return {
    provider,
    model,
    origem: "env",
    aviso: valido
      ? undefined
      : `LLM_PROVIDER="${bruto}" não é um provedor conhecido; usando "anthropic". Válidos: ${CATALOGO.map((p) => p.id).join(", ")}.`,
  };
}

/**
 * O que está valendo: a linha "llm" da tabela configuracoes quando existe,
 * senão o .env. Uma leitura por resposta do chat — barata e sempre atual, o
 * que é o ponto de trocar o modelo pelo painel sem reiniciar o servidor.
 */
export async function lerConfigLlm(): Promise<ConfigLlm> {
  let linha;
  try {
    [linha] = await db
      .select()
      .from(schema.configuracoes)
      .where(eq(schema.configuracoes.chave, CHAVE))
      .limit(1);
  } catch (err) {
    // Banco fora do ar ou migração 0004 não aplicada: o chat continua com o
    // .env em vez de morrer por causa da configuração.
    console.warn(
      "Não consegui ler a configuração de LLM do banco; usando o .env:",
      err instanceof Error ? err.message : String(err),
    );
    return configDoEnv();
  }

  if (!linha) return configDoEnv();

  const salvo = linha.valor as { provider?: string; model?: string };
  if (!salvo.provider || !ehProvedorValido(salvo.provider)) return configDoEnv();

  return {
    provider: salvo.provider,
    model:
      salvo.model?.trim() || provedorDoCatalogo(salvo.provider)!.modeloPadrao,
    origem: "painel",
  };
}

export async function salvarConfigLlm(entrada: {
  provider: NomeProvedor;
  model?: string;
}): Promise<ConfigLlm> {
  const model =
    entrada.model?.trim() || provedorDoCatalogo(entrada.provider)!.modeloPadrao;
  const valor = { provider: entrada.provider, model };

  await db
    .insert(schema.configuracoes)
    .values({ chave: CHAVE, valor })
    .onConflictDoUpdate({
      target: schema.configuracoes.chave,
      set: { valor, atualizadoEm: new Date() },
    });

  return { ...valor, origem: "painel" };
}

/** Remove a escolha do painel e devolve o controle ao .env. */
export async function limparConfigLlm(): Promise<ConfigLlm> {
  await db
    .delete(schema.configuracoes)
    .where(eq(schema.configuracoes.chave, CHAVE));
  return configDoEnv();
}

/**
 * Chaves de API continuam só no .env. O painel não as edita — apenas mostra
 * quais provedores têm chave, para a troca não virar erro na primeira pergunta.
 */
export function chaveConfigurada(provider: NomeProvedor): boolean {
  return Boolean(process.env[provedorDoCatalogo(provider)!.envChave]?.trim());
}
