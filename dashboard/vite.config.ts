import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { squadWatcherPlugin } from "./src/plugin/squadWatcher";

export default defineConfig({
  // Porta fixa para não concorrer com o app estático (5173) nem outros projetos.
  server: { port: 5175, strictPort: true },
  plugins: [react(), squadWatcherPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
