/**
 * ESLint flat config — TypeScript é validado por `tsc --noEmit` (typecheck).
 * Espree não parseia TS; por isso .ts/.tsx ficam só com ignore + regras JS.
 * Evita 500+ "Parsing error: Unexpected token" falsos no CI.
 */
export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "reports/**",
      "coverage/**",
      "next-env.d.ts",
      "e2e/**",
      // TS/TSX: use typecheck, não eslint sem typescript-eslint
      "**/*.ts",
      "**/*.tsx",
      "**/*.mts",
      "**/*.cts",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-unused-expressions": "warn",
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
];
