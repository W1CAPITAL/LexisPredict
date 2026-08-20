/**
 * ESLint sem typescript-eslint.
 * eslint-config-next puxa typescript-eslint, que ainda não aceita TypeScript 7.0.
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
    ],
  },
];
