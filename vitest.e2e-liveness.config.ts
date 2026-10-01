import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e-liveness',
    include: ['tools/gates/**/*.browser.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    fileParallelism: false,
    passWithNoTests: false,
  },
});
