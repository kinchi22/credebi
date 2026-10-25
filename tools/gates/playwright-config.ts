import { execFileSync } from 'node:child_process';
import type { PlaywrightTestConfig } from '@playwright/test';
import { REPO_ROOT } from './run-gate';

export const playwrightConfigFor = (env: NodeJS.ProcessEnv): PlaywrightTestConfig =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import config from './playwright.config.ts';
console.log(JSON.stringify(config));`,
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          CI: undefined,
          E2E_LIVENESS: undefined,
          E2E_ADVISORY: undefined,
          E2E_BASE_URL: undefined,
          ...env,
        },
        encoding: 'utf8',
      },
    ),
  ) as PlaywrightTestConfig;
