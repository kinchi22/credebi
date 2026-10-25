import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PHONE } from '../../e2e/viewport';
import { bin, REPO_ROOT, runGate } from './run-gate';

const FIXTURE_CONFIG = path.join(REPO_ROOT, 'fixtures/e2e-projects/playwright.config.ts');

type ListedTest = { readonly projectName: string };
type ListedSpec = { readonly title: string; readonly tests: readonly ListedTest[] };
type ListedSuite = { readonly specs: readonly ListedSpec[]; readonly suites?: readonly ListedSuite[] };

const specsOf = (suites: readonly ListedSuite[]): readonly ListedSpec[] =>
  suites.flatMap((suite) => [...suite.specs, ...specsOf(suite.suites ?? [])]);

const listed = (args: readonly string[]): readonly ListedSpec[] => {
  const run = runGate(bin('playwright'), ['test', '--list', '--reporter=json', ...args], REPO_ROOT);
  expect(run.status, run.stderr).toBe(0);
  return specsOf((JSON.parse(run.stdout) as { readonly suites: readonly ListedSuite[] }).suites);
};

const projectsOf = (specs: readonly ListedSpec[], title: string): readonly string[] =>
  specs
    .filter((spec) => spec.title === title)
    .flatMap((spec) => spec.tests.map((test) => test.projectName))
    .sort();

type ProjectUse = {
  readonly defaultBrowserType?: string;
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly hasTouch?: boolean;
  readonly isMobile?: boolean;
};

const projectUse = (name: string): ProjectUse =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import config from './playwright.config.ts';
console.log(JSON.stringify(config.projects?.find((project) => project.name === ${JSON.stringify(name)})?.use ?? null));`,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ),
  ) as ProjectUse;

const workflow = (name: string): string =>
  readFileSync(path.join(REPO_ROOT, '.github', 'workflows', name), 'utf8');

const installs = (text: string): readonly string[] =>
  [...text.matchAll(/pnpm exec playwright install --with-deps ([^\n&]+?)\s*(?:&&)?\n/g)].map(
    (match) => match[1] ?? '',
  );

describe('the Playwright projects', () => {
  it('runs a spec tagged @webkit in Chromium and in mobile WebKit', () => {
    expect(projectsOf(listed(['--config', FIXTURE_CONFIG]), 'states a behaviour that depends on the engine')).toEqual([
      'chromium',
      'mobile-webkit',
    ]);
  });

  it('runs an untagged spec in Chromium alone', () => {
    expect(projectsOf(listed(['--config', FIXTURE_CONFIG]), 'states a behaviour every engine shares')).toEqual([
      'chromium',
    ]);
  });

  it('emulates a phone with touch in mobile WebKit', () => {
    expect(projectUse('mobile-webkit')).toMatchObject({
      defaultBrowserType: 'webkit',
      viewport: PHONE,
      hasTouch: true,
      isMobile: true,
    });
  });

  it('runs every Smoke-tagged spec in Chromium alone', () => {
    const projects = listed(['--grep', '@smoke']).flatMap((spec) => spec.tests.map((test) => test.projectName));

    expect(projects.length).toBeGreaterThan(0);
    expect(new Set(projects)).toEqual(new Set(['chromium']));
  });
});

describe('the browsers each workflow installs', () => {
  it.each([['ci.yml'], ['e2e-build.yml']])('installs Chromium and WebKit where %s runs the specs', (name) => {
    expect(installs(workflow(name))).toEqual(['chromium webkit']);
  });

  it.each([['candidate-production-smoke.yml'], ['promoted-production-smoke.yml'], ['production-release.yml']])(
    'installs Chromium alone for the Smoke run in %s',
    (name) => {
      expect(installs(workflow(name))).toEqual(['chromium']);
    },
  );
});
