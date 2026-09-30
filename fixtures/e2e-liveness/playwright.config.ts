import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: process.env['E2E_LIVENESS_FIXTURE'] ?? 'ordinary-input.spec.ts',
  outputDir: '../../test-results/e2e-liveness-fixtures',
  webServer: [],
});
