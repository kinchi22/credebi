import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { PlaywrightTestConfig } from '@playwright/test';
import { describe, expect, it } from 'vitest';

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
  webServer: config.webServer,
  use: {
    actionTimeout: config.use?.actionTimeout,
    baseURL: config.use?.baseURL,
    trace: config.use?.trace,
  },
}));`,
      ],
      {
        cwd: path.resolve(import.meta.dirname, '../..'),
        env: { ...process.env, E2E_LIVENESS: undefined, E2E_BASE_URL: undefined, ...env },
        encoding: 'utf8',
      },
    ),
  ) as PlaywrightTestConfig;

describe('the E2E liveness configuration', () => {
  it('limits action waits and uses two workers when liveness is requested', () => {
    const config = configFor({ E2E_LIVENESS: '1', E2E_BASE_URL: 'http://127.0.0.1:4321' });

    expect(config.workers).toBe(2);
    expect(config.use).toMatchObject({
      actionTimeout: 1000,
      baseURL: 'http://127.0.0.1:4321',
      trace: 'on-first-retry',
    });
    expect(config.timeout).toBeUndefined();
    expect(config.expect?.timeout).toBeUndefined();
  });

  it.each([
    { mode: 'local', env: {}, baseURL: 'http://127.0.0.1:3000' },
    { mode: 'external', env: { E2E_BASE_URL: 'https://example.com' }, baseURL: 'https://example.com' },
  ])('keeps the default action timeout and worker count for $mode app tests', ({ env, baseURL }) => {
    const config = configFor(env);

    expect(config.workers).toBeUndefined();
    expect(config.use?.actionTimeout).toBeUndefined();
    expect(config.use?.baseURL).toBe(baseURL);
    if (env.E2E_BASE_URL === undefined) {
      expect(config.webServer).toMatchObject({ command: 'pnpm --filter @repo/web start' });
    } else {
      expect(config.webServer).toBeUndefined();
    }
  });
});
