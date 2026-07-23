import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
  },
  server: {
    // Em produção o app e o gateway de IA são servidos pelo MESMO endereço
    // (`servidor/sementeira-servidor.cjs`), então `/api/...` é mesma origem e
    // não existe CORS. No `npm run dev` o Vite serve numa porta diferente da do
    // servidor, e sem este proxy o gateway seria inalcançável em
    // desenvolvimento — o servidor não emite cabeçalho de CORS de propósito.
    proxy: {
      "/api": {
        target: process.env.SEMENTEIRA_SERVIDOR || "http://127.0.0.1:7010",
        changeOrigin: true,
      },
    },
  },
});
