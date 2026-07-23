import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Este projeto vive em /web dentro de um repositório maior (que tem seu
  // próprio package-lock.json) — fixamos a raiz aqui pra o Turbopack não
  // tentar adivinhar e acertar sempre.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
