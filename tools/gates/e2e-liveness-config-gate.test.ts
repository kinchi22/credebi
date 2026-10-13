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
  retries: config.retries,
  reporter: config.reporter,
  timeout: config.timeout,
  expect: config.expect,
  webServer: config.webServer,
  use: {
    actionTimeout: config.use?.actionTimeout,
    trace: config.use?.trace,
  },
}));`,
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

describe('the strict and advisory E2E configuration', () => {
  it('retries a failing test twice in CI and records a trace on the first retry', () => {
    const config = configFor({ CI: 'true' });

    expect(config.retries).toBe(2);
    expect(config.use?.trace).toBe('on-first-retry');
    expect(config.reporter).toEqual([['github'], ['html', { open: 'never' }]]);
  });

  it('runs each test once outside CI and lists the results', () => {
    const config = configFor({});

    expect(config.retries).toBe(0);
    expect(config.use?.trace).toBe('on-first-retry');
    expect(config.reporter).toEqual([['list']]);
  });

  it.each([
    { mode: 'CI', env: { CI: 'true' }, reporter: [['github'], ['html', { open: 'never' }], ['json']] },
    { mode: 'local', env: {}, reporter: [['list'], ['html', { open: 'never' }], ['json']] },
  ])(
    'runs each advisory test once in $mode, keeps its first failed trace and writes HTML and JSON reports',
    ({ env, reporter }) => {
      const config = configFor({ ...env, E2E_ADVISORY: '1' });

      expect(config.retries).toBe(0);
      expect(config.use?.trace).toBe('retain-on-first-failure');
      expect(config.reporter).toEqual(reporter);
    },
  );

  it('keeps the ordinary waits, workers and server start for advisory app tests', () => {
    const strict = configFor({ CI: 'true' });
    const advisory = configFor({ CI: 'true', E2E_ADVISORY: '1' });

    expect(advisory.workers).toBe(strict.workers);
    expect(advisory.timeout).toBe(strict.timeout);
    expect(advisory.expect).toEqual(strict.expect);
    expect(advisory.use?.actionTimeout).toBeUndefined();
    expect(advisory.webServer).toEqual(strict.webServer);
  });
});
