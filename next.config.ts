import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // TypeScript 7 (nativo) não expõe a compiler API que o Next usa por padrão;
  // esta flag faz o build chamar o CLI do tsc.
  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
