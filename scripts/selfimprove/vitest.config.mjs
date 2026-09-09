// Vitest mínimo para os testes do autoaprimoramento — sem PostCSS/Tailwind
// (a cadeia vite→postcss.config.mjs falha quando o node_modules está incompleto).
// Uso: npx vitest run --config scripts/selfimprove/vitest.config.mjs
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/selfimprove-lib.test.ts"],
    globals: false,
  },
  css: { postcss: false },
});
