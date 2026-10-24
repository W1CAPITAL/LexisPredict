import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Vitest executa no Node sem o pacote sentinel de Next, mas produção mantém import server-only.
      'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
});
