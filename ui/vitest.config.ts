import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/i18n/**/*.test.ts', 'src/i18n/**/*.test.tsx'],
    environment: 'node',
  },
});
