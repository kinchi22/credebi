import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

export default defineConfig({
  ...base,
  testDir: '.',
  outputDir: '../../test-results/e2e-projects-fixtures',
  webServer: [],
});
