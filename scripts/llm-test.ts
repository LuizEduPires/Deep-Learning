/**
 * Fumaça do provedor de LLM que está valendo — o do painel do chat quando
 * houve troca por lá, o do .env caso contrário.
 *
 * Verifica as duas coisas que fazem o chat funcionar: a chamada autentica e o
 * modelo sabe chamar ferramenta. A segunda importa porque nem todo modelo do
 * catálogo do OpenRouter suporta tool calling, e sem isso o agente responde
 * sem consultar Agrofit, Bioinsumos ou a base de conhecimento.
 *
 *   npm run llm:test
 */
import { getProvider } from "../src/server/llm";

async function main() {
  const provider = await getProvider();
  console.log(`Provedor: ${provider.name} | Modelo: ${provider.model}`);

  let chamouFerramenta = false;

  const resposta = await provider.chat({
    system:
      "Você é um agrônomo. Use as ferramentas disponíveis para responder com dados.",
    messages: [
      {
        role: "user",
        content: "Qual a temperatura média de Petrolina? Consulte a ferramenta.",
      },
    ],
    tools: [
      {
        name: "clima_teste",
        description: "Retorna a temperatura média anual de uma cidade.",
        parameters: {
          type: "object",
          properties: {
            cidade: { type: "string", description: "Nome da cidade" },
          },
          required: ["cidade"],
        },
        run: async (input) => {
          chamouFerramenta = true;
          console.log("  ferramenta chamada com:", input);
          return {
            text: "Temperatura média anual: 26,5 °C",
            sources: [{ tool: "clima_teste", label: "Fonte de teste" }],
          };
        },
      },
    ],
    ctx: {},
  });

  console.log("\nResposta:", resposta.text);
  console.log("Fontes:", resposta.sources);
  console.log(
    chamouFerramenta
      ? "\nOK — autenticou e usou tool calling."
      : "\nAtenção: autenticou, mas o modelo respondeu sem chamar a ferramenta. Verifique se ele suporta tool calling.",
  );
}

main().catch((err) => {
  console.error("Falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});
