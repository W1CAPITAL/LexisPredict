/**
 * ESLint sem typescript-eslint (ainda não cobre TypeScript 7).
 * Regras práticas para evitar regressões óbvias de build.
 * https://github.com/typescript-eslint/typescript-eslint/issues/10940
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
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-unused-expressions": "warn",
      "eqeqeq": ["warn", "smart"],
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
];
