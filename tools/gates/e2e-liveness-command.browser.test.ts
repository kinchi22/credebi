import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type LivenessReport,
  type ReportSpec,
  runAgainstEmptyPage,
  specsIn,
} from '../verify-e2e-liveness';
import { bin, REPO_ROOT, runGate } from './run-gate';

const FIXTURE_CONFIG = path.join(REPO_ROOT, 'fixtures/e2e-liveness/playwright.config.ts');

afterEach(() => {
  vi.unstubAllEnvs();
});

const identity = (spec: ReportSpec): string =>
  `${spec.file}:${String(spec.line)} ${spec.title} (${String(spec.tests.length)})`;

describe('the E2E liveness command with Chromium', () => {
  it('fails a missing input within the action budget even when the spec is slow', async () => {
    vi.stubEnv('E2E_LIVENESS_FIXTURE', 'missing-input.spec.ts');

    const run = await runAgainstEmptyPage(REPO_ROOT, FIXTURE_CONFIG);

    expect(run.problems).toEqual([]);
    expect(specsIn(run.report?.suites ?? [])).toHaveLength(1);
    const result = specsIn(run.report?.suites ?? [])[0]?.tests[0]?.results[0];
    expect(result?.errors.some(({ message }) => message.includes('Timeout 1000ms exceeded'))).toBe(true);
  });

  it('allows an ordinary app test to wait beyond the liveness action budget', () => {
    vi.stubEnv('E2E_LIVENESS', undefined);
    vi.stubEnv('E2E_LIVENESS_FIXTURE', 'ordinary-input.spec.ts');
    vi.stubEnv('PLAYWRIGHT_JSON_OUTPUT_NAME', undefined);
    const run = runGate(
      bin('playwright'),
      ['test', '--config', FIXTURE_CONFIG, '--retries=0', '--forbid-only', '--reporter=json'],
      REPO_ROOT,
    );

    expect(run.status, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout) as LivenessReport;
    expect(specsIn(report.suites).flatMap((spec) => spec.tests.map((test) => test.status))).toEqual([
      'expected',
    ]);
  });

  it('rejects a spec that passes against the empty page', async () => {
    vi.stubEnv('E2E_LIVENESS_FIXTURE', 'no-assertions.spec.ts');

    const run = await runAgainstEmptyPage(REPO_ROOT, FIXTURE_CONFIG);

    expect(run.problems).toHaveLength(1);
    expect(run.problems[0]).toContain('passed against an empty page');
  });

  it('rejects a browser launch failure before the spec runs', async () => {
    vi.stubEnv('E2E_LIVENESS_FIXTURE', 'browser-failure.spec.ts');

    const run = await runAgainstEmptyPage(REPO_ROOT, FIXTURE_CONFIG);

    expect(run.problems).toEqual(expect.arrayContaining([
      expect.stringContaining('failed outside the spec'),
      expect.stringContaining('browserType.launch'),
      'the empty page was never requested, so the specs did not run against it.',
    ]));
  });

  it('runs every collected app spec against the empty page', { timeout: 0 }, async () => {
    vi.stubEnv('PLAYWRIGHT_JSON_OUTPUT_NAME', undefined);
    const listed = runGate(
      bin('playwright'),
      ['test', '--list', '--forbid-only', '--reporter=json'],
      REPO_ROOT,
    );
    expect(listed.status, listed.stderr).toBe(0);
    const collected = JSON.parse(listed.stdout) as LivenessReport;

    const run = await runAgainstEmptyPage(REPO_ROOT);

    expect(run.problems).toEqual([]);
    expect(run.report?.config.workers).toBe(2);
    expect(specsIn(run.report?.suites ?? []).map(identity).sort()).toEqual(
      specsIn(collected.suites).map(identity).sort(),
    );
  });
});
