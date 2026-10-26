import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // "server-only" lève une erreur hors environnement React Server : neutralisé pour les tests.
    alias: { "server-only": new URL("./tests/helpers/empty.ts", import.meta.url).pathname },
  },
  test: {
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    // Les tests d'intégration partagent une base PostgreSQL : exécution séquentielle.
    fileParallelism: false,
  },
});
