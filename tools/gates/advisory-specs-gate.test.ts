import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifySpecFiles, compareWithBase } from '../run-advisory-specs';
import { type LivenessReport, specsIn } from '../verify-e2e-liveness';
import { REPO_ROOT } from './run-gate';

const COMMAND = path.join(REPO_ROOT, 'tools', 'run-advisory-specs.ts');

const sandbox = mkdtempSync(path.join(realpathSync(tmpdir()), 'advisory-specs-'));

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string => {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid', '-c', 'init.defaultBranch=main', ...args],
    { cwd, encoding: 'utf8' },
  );
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
};

const write = (repository: string, file: string, content: string): void => {
  mkdirSync(path.dirname(path.join(repository, file)), { recursive: true });
  writeFileSync(path.join(repository, file), content);
};

const commit = (repository: string, message: string): void => {
  git(repository, 'add', '--all');
  git(repository, 'commit', '--quiet', '--allow-empty', '-m', message);
};

let repositories = 0;
const newRepository = (): string => {
  repositories += 1;
  const repository = path.join(sandbox, `repo-${String(repositories)}`);
  mkdirSync(repository);
  git(repository, 'init', '--quiet');
  return repository;
};

const requirement = (name: string): string =>
  [
    `import { expect, test } from '@playwright/test';`,
    '',
    `test.describe('${name}', () => {`,
    ...Array.from({ length: 8 }, (_, line) => `  test('${name} holds ${String(line)}', () => { expect(${String(line)}).toBe(${String(line)}); });`),
    '});',
    '',
  ].join('\n');

const groupsOf = (repository: string, base = 'main'): unknown => {
  const comparison = compareWithBase(repository, base);
  return comparison.ok ? comparison.classification : comparison.problem;
};

describe('classifySpecFiles', () => {
  it('counts only spec files under e2e/, so helpers never decide a group', () => {
    expect(
      classifySpecFiles(
        ['e2e/kept.spec.ts', 'e2e/helper.ts', 'README.md'],
        ['e2e/kept.spec.ts', 'e2e/helper.ts', 'e2e/new-helper.ts', 'tools/new.test.ts', 'e2e/added.spec.ts'],
        [],
      ),
    ).toEqual({ existing: ['e2e/kept.spec.ts'], feature: ['e2e/added.spec.ts'], removed: [] });
  });

  it('treats a helper renamed into a spec file as an added spec', () => {
    expect(
      classifySpecFiles(['e2e/helper.ts'], ['e2e/helper.spec.ts'], [{ from: 'e2e/helper.ts', to: 'e2e/helper.spec.ts' }]),
    ).toEqual({ existing: [], feature: ['e2e/helper.spec.ts'], removed: [] });
  });

  it('lists a spec file renamed into a helper as removed', () => {
    expect(
      classifySpecFiles(['e2e/old.spec.ts'], ['e2e/old.ts'], [{ from: 'e2e/old.spec.ts', to: 'e2e/old.ts' }]),
    ).toEqual({ existing: [], feature: [], removed: ['e2e/old.spec.ts'] });
  });
});

describe('compareWithBase, against real Git histories', () => {
  const repository = newRepository();

  beforeAll(() => {
    for (const name of ['kept', 'edited', 'renamed', 'removed', 'retired']) {
      write(repository, `e2e/${name}.spec.ts`, requirement(name));
    }
    write(repository, 'e2e/helper.ts', 'export const helper = 1;\n');
    commit(repository, 'inherited');
    git(repository, 'branch', 'milestone/x');

    git(repository, 'switch', '--quiet', 'milestone/x');
    write(repository, 'e2e/added.spec.ts', requirement('added'));
    appendFileSync(path.join(repository, 'e2e/edited.spec.ts'), `test('appended', () => {});\n`);
    write(repository, 'e2e/helper.ts', 'export const helper = 2;\n');
    write(repository, 'e2e/new-helper.ts', 'export const extracted = 1;\n');
    git(repository, 'mv', 'e2e/renamed.spec.ts', 'e2e/renamed-now.spec.ts');
    git(repository, 'rm', '--quiet', 'e2e/removed.spec.ts');
    commit(repository, 'milestone work');

    git(repository, 'switch', '--quiet', 'main');
    write(repository, 'e2e/on-main.spec.ts', requirement('on-main'));
    git(repository, 'rm', '--quiet', 'e2e/retired.spec.ts');
    commit(repository, 'main advances');
    git(repository, 'switch', '--quiet', 'milestone/x');
  });

  it('classifies additions as Feature specs, and edits and recognized renames as existing specs', () => {
    expect(groupsOf(repository)).toEqual({
      feature: ['e2e/added.spec.ts'],
      existing: ['e2e/edited.spec.ts', 'e2e/kept.spec.ts', 'e2e/renamed-now.spec.ts', 'e2e/retired.spec.ts'],
      removed: ['e2e/removed.spec.ts'],
    });
  });

  it('keeps the baseline the milestone inherited while main advances unmerged', () => {
    const before = groupsOf(repository);
    git(repository, 'switch', '--quiet', 'main');
    write(repository, 'e2e/later-on-main.spec.ts', requirement('later'));
    commit(repository, 'main advances again');
    git(repository, 'switch', '--quiet', 'milestone/x');

    expect(groupsOf(repository)).toEqual(before);
  });

  it('moves what main added into the existing specs once main is merged into the milestone', () => {
    git(repository, 'merge', '--quiet', '--no-edit', 'main');

    expect(groupsOf(repository)).toEqual({
      feature: ['e2e/added.spec.ts'],
      existing: [
        'e2e/edited.spec.ts',
        'e2e/kept.spec.ts',
        'e2e/later-on-main.spec.ts',
        'e2e/on-main.spec.ts',
        'e2e/renamed-now.spec.ts',
      ],
      removed: ['e2e/removed.spec.ts'],
    });
  });

  it('puts every current spec in the existing group when no spec file was added', () => {
    git(repository, 'switch', '--quiet', '--create', 'milestone/edits-only', 'main');
    appendFileSync(path.join(repository, 'e2e/kept.spec.ts'), `test('appended', () => {});\n`);
    commit(repository, 'edit only');

    expect(groupsOf(repository)).toEqual({
      feature: [],
      existing: [
        'e2e/edited.spec.ts',
        'e2e/kept.spec.ts',
        'e2e/later-on-main.spec.ts',
        'e2e/on-main.spec.ts',
        'e2e/removed.spec.ts',
        'e2e/renamed.spec.ts',
      ],
      removed: [],
    });
  });

  it('fails visibly when the base reference does not exist', () => {
    expect(groupsOf(repository, 'origin/main')).toContain('origin/main does not name a commit here');
  });

  it('fails visibly when the base shares no history with HEAD', () => {
    git(repository, 'switch', '--quiet', '--orphan', 'unrelated');
    write(repository, 'e2e/alone.spec.ts', requirement('alone'));
    commit(repository, 'unrelated');

    expect(groupsOf(repository)).toContain('main and HEAD have no merge-base');
  });

  it('fails visibly, naming the shallow clone, when the history is too short', () => {
    const clone = path.join(sandbox, 'shallow');
    git(sandbox, 'clone', '--quiet', '--depth', '1', '--branch', 'milestone/x', `file://${repository}`, clone);
    git(clone, 'fetch', '--quiet', '--depth', '1', 'origin', 'main:refs/remotes/origin/main');

    const problem = groupsOf(clone, 'origin/main');

    expect(problem).toContain('origin/main and HEAD have no merge-base');
    expect(problem).toContain('shallow');
  });

  it('fails visibly when Git cannot read the merge-base tree', () => {
    const broken = newRepository();
    write(broken, 'e2e/kept.spec.ts', requirement('kept'));
    commit(broken, 'inherited');
    const tree = git(broken, 'rev-parse', 'HEAD:e2e');
    git(broken, 'switch', '--quiet', '--create', 'milestone/x');
    write(broken, 'e2e/added.spec.ts', requirement('added'));
    commit(broken, 'added');
    unlinkSync(path.join(broken, '.git', 'objects', tree.slice(0, 2), tree.slice(2)));

    expect(groupsOf(broken)).toMatch(/^git ls-tree .* failed: /);
  });
});

type Run = { readonly status: number; readonly stdout: string; readonly stderr: string };

describe('run-advisory-specs.ts, run as CI runs it', () => {
  const repository = newRepository();
  const config = path.join(repository, 'playwright.advisory-fixture.config.ts');

  const run = (...args: string[]): Run => {
    const result = spawnSync(process.execPath, [COMMAND, ...args], {
      cwd: repository,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: 'true',
        E2E_LIVENESS: '1',
        E2E_BASE_URL: undefined,
        E2E_ADVISORY: undefined,
        PLAYWRIGHT_JSON_OUTPUT_NAME: undefined,
        PLAYWRIGHT_HTML_OUTPUT_DIR: undefined,
        GITHUB_ACTIONS: undefined,
      },
    });
    return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
  };

  const reportOf = (group: string): LivenessReport =>
    JSON.parse(
      readFileSync(path.join(repository, 'test-results', `advisory-${group}`, 'report.json'), 'utf8'),
    ) as LivenessReport;

  const executed = (group: string): readonly string[] =>
    specsIn(reportOf(group).suites)
      .map((spec) => `${spec.file} ${spec.title} ${spec.tests.map((test) => `${test.status}x${String(test.results.length)}`).join()}`)
      .sort();

  beforeAll(() => {
    symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(repository, 'node_modules'));
    write(repository, '.gitignore', 'node_modules\ntest-results/\nplaywright-report/\n');
    write(
      repository,
      'playwright.advisory-fixture.config.ts',
      [
        `import { defineConfig } from '@playwright/test';`,
        `import base from ${JSON.stringify(path.join(REPO_ROOT, 'playwright.config.ts'))};`,
        '',
        `export default defineConfig({ ...base, testDir: './e2e', webServer: [] });`,
        '',
      ].join('\n'),
    );
    write(repository, 'e2e/helper.ts', `export const answer = (): number => 42;\n`);
    write(
      repository,
      'e2e/inherited.spec.ts',
      [
        `import { expect, test } from '@playwright/test';`,
        `import { answer } from './helper';`,
        '',
        `test('inherited answers', () => { expect(answer()).toBe(42); });`,
        `test('inherited waits as long as ever', ({}, testInfo) => { expect(testInfo.project.use.actionTimeout).toBeUndefined(); });`,
        '',
      ].join('\n'),
    );
    commit(repository, 'inherited');

    git(repository, 'switch', '--quiet', '--create', 'milestone/x');
    write(repository, 'e2e/helper.ts', `export const answer = (): number => 40 + 2;\n`);
    appendFileSync(
      path.join(repository, 'e2e/inherited.spec.ts'),
      `test('inherited still answers', () => { expect(answer()).toBe(42); });\n`,
    );
    write(
      repository,
      'e2e/added.spec.ts',
      [
        `import { expect, test } from '@playwright/test';`,
        '',
        `test('added is built', () => { expect(1).toBe(1); });`,
        `test('added is not built yet', () => { expect('built').toBe('missing'); });`,
        '',
      ].join('\n'),
    );
    commit(repository, 'milestone work');
  });

  it('runs only the added spec files once each, and keeps their failure', () => {
    const result = run('feature', '--base', 'main', '--config', config);

    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(executed('feature')).toEqual([
      'added.spec.ts added is built expectedx1',
      'added.spec.ts added is not built yet unexpectedx1',
    ]);
    expect(result.stdout).toContain('Feature specs, spec files added since the merge-base (1):\n  e2e/added.spec.ts');
    expect(result.stderr).toContain('Feature specs: 1 passed, 1 failed, 0 flaky, 0 skipped, from 1 of 1 selected spec files.');
  });

  it('keeps the first failed attempt trace and the HTML report under the group', () => {
    const outputs = readdirSync(path.join(repository, 'test-results', 'advisory-feature'), { recursive: true }).map(String);
    expect(outputs.filter((file) => file.endsWith('trace.zip'))).toHaveLength(1);
    expect(existsSync(path.join(repository, 'playwright-report', 'advisory-feature', 'index.html'))).toBe(true);
  });

  it('runs the inherited spec files, edited ones included, against the current helpers', () => {
    const result = run('existing', '--base', 'main', '--config', config);

    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(executed('existing')).toEqual([
      'inherited.spec.ts inherited answers expectedx1',
      'inherited.spec.ts inherited still answers expectedx1',
      'inherited.spec.ts inherited waits as long as ever expectedx1',
    ]);
    expect(result.stdout).toContain('Existing specs: 3 passed, 0 failed, 0 flaky, 0 skipped, from 1 of 1 selected spec files.');
    expect(existsSync(path.join(repository, 'playwright-report', 'advisory-existing', 'index.html'))).toBe(true);
    expect(existsSync(path.join(repository, 'playwright-report', 'advisory-feature', 'index.html'))).toBe(true);
    expect(executed('feature')).toHaveLength(2);
  });

  it('reports an empty group as skipped and never starts Playwright', () => {
    git(repository, 'switch', '--quiet', '--create', 'milestone/edits-only', 'main');
    appendFileSync(path.join(repository, 'e2e/inherited.spec.ts'), `test('appended', () => {});\n`);
    commit(repository, 'edit only');
    rmSync(path.join(repository, 'test-results'), { recursive: true, force: true });

    const result = run('feature', '--base', 'main', '--config', config);

    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('No feature specs to run, so Playwright was not started. Skipped.');
    expect(existsSync(path.join(repository, 'test-results'))).toBe(false);
  });

  it('fails without running anything when the base reference is missing', () => {
    const result = run('existing', '--config', config);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Existing specs were not run: the comparison failed.');
    expect(result.stderr).toContain('origin/main does not name a commit here');
    expect(existsSync(path.join(repository, 'test-results'))).toBe(false);
  });

  it('fails when a selected spec file is missing from the working tree', () => {
    unlinkSync(path.join(repository, 'e2e/inherited.spec.ts'));
    const result = run('existing', '--base', 'main', '--config', config);
    git(repository, 'checkout', '--', 'e2e/inherited.spec.ts');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('the selection is unusable');
    expect(existsSync(path.join(repository, 'test-results'))).toBe(false);
  });

  it('reports a run that wrote no report as incomplete', () => {
    write(repository, 'broken.config.ts', `throw new Error('configuration cannot load');\n`);

    const result = run('existing', '--base', 'main', '--config', path.join(repository, 'broken.config.ts'));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Existing specs are incomplete: Playwright wrote no report');
  });

  it('fails when the selected files never ran under the configuration given', () => {
    write(
      repository,
      'elsewhere.config.ts',
      [
        `import { defineConfig } from '@playwright/test';`,
        `import base from ${JSON.stringify(path.join(REPO_ROOT, 'playwright.config.ts'))};`,
        '',
        `export default defineConfig({ ...base, testDir: './elsewhere', webServer: [] });`,
        '',
      ].join('\n'),
    );
    write(repository, 'elsewhere/inherited.spec.ts', `import { test } from '@playwright/test';\ntest('elsewhere', () => {});\n`);

    const result = run('existing', '--base', 'main', '--config', path.join(repository, 'elsewhere.config.ts'));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('selected but never run: e2e/inherited.spec.ts');
    expect(result.stderr).toContain('run but never selected: e2e/../elsewhere/inherited.spec.ts');
  });

  it('rejects a group it does not know', () => {
    const result = run('everything');

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage: run-advisory-specs.ts <existing|feature>');
  });
});
