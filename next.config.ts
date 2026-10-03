import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // O botão flutuante do Next (só em dev) ficava sobre o rodapé do menu
  // lateral e a barra de abas. Erros de build e runtime seguem aparecendo.
  devIndicators: false,
  // Em dev o Next só serve os scripts da página para localhost; sem isto, o
  // app aberto no celular pelo IP do PC na rede local não funciona.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // TypeScript 7 (nativo) não expõe a compiler API que o Next usa por padrão;
  // esta flag faz o build chamar o CLI do tsc.
  experimental: {
    useTypeScriptCli: true,
    proxyClientMaxBodySize: "21mb",
  },
};

export default nextConfig;
