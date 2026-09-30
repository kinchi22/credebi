import { execFileSync } from 'node:child_process';
import type { PlaywrightTestConfig } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './run-gate';

const configFor = (env: NodeJS.ProcessEnv): PlaywrightTestConfig =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import config from './playwright.config.ts';
console.log(JSON.stringify({
  workers: config.workers,
  timeout: config.timeout,
  expect: config.expect,
  use: {
    actionTimeout: config.use?.actionTimeout,
  },
}));`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, E2E_LIVENESS: undefined, E2E_BASE_URL: undefined, ...env },
        encoding: 'utf8',
      },
    ),
  ) as PlaywrightTestConfig;

describe('the E2E liveness configuration', () => {
  it('limits action waits when liveness is requested', () => {
    const config = configFor({ E2E_LIVENESS: '1', E2E_BASE_URL: 'http://127.0.0.1:4321' });

    expect(config.use?.actionTimeout).toBe(1000);
    expect(config.timeout).toBeUndefined();
    expect(config.expect?.timeout).toBeUndefined();
  });

  it.each([
    { mode: 'local', env: {} },
    { mode: 'external', env: { E2E_BASE_URL: 'https://example.com' } },
  ])('keeps the default action timeout and worker count for $mode app tests', ({ env }) => {
    const config = configFor(env);

    expect(config.workers).toBeUndefined();
    expect(config.use?.actionTimeout).toBeUndefined();
  });
});
