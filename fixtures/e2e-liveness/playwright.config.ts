import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

const fixture = process.env['E2E_LIVENESS_FIXTURE'];
if (!fixture) throw new Error('E2E_LIVENESS_FIXTURE must select a fixture.');

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: fixture,
  outputDir: '../../test-results/e2e-liveness-fixtures',
  webServer: [],
});
