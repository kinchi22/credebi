import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SPEC_ROOT } from './check-pr-isolation.ts';
import { type LivenessReport, type ReportSpec, specsIn } from './verify-e2e-liveness.ts';

export const GROUPS = ['existing', 'feature'] as const;

export type Group = (typeof GROUPS)[number];

export const DEFAULT_BASE = 'origin/main';

export type Rename = { readonly from: string; readonly to: string };

export type Classification = {
  readonly existing: readonly string[];
  readonly feature: readonly string[];
  readonly removed: readonly string[];
};

export type Comparison =
  | {
      readonly ok: true;
      readonly head: string;
      readonly mergeBase: string;
      readonly classification: Classification;
    }
  | { readonly ok: false; readonly problem: string };

const LABEL: Record<Group, string> = { existing: 'Existing specs', feature: 'Feature specs' };

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

export const isSpecFile = (file: string): boolean =>
  file.startsWith(SPEC_ROOT) && /\.(spec|test)\.[cm]?[jt]sx?$/.test(file);

export function classifySpecFiles(
  baseline: readonly string[],
  current: readonly string[],
  renames: readonly Rename[],
): Classification {
  const inherited = new Set(baseline.filter(isSpecFile));
  const present = new Set(current.filter(isSpecFile));
  const renamed = renames.filter(({ from, to }) => inherited.has(from) && present.has(to));
  const carried = new Set(renamed.map(({ to }) => to));
  const moved = new Set(renamed.map(({ from }) => from));

  const sorted = (files: Iterable<string>): readonly string[] => [...files].sort();
  const isInherited = (file: string): boolean => inherited.has(file) || carried.has(file);

  return {
    existing: sorted([...present].filter(isInherited)),
    feature: sorted([...present].filter((file) => !isInherited(file))),
    removed: sorted([...inherited].filter((file) => !present.has(file) && !moved.has(file))),
  };
}

type GitResult = { readonly ok: true; readonly stdout: string } | { readonly ok: false; readonly problem: string };

function git(cwd: string, args: readonly string[]): GitResult {
  const result = spawnSync('git', [...args], { cwd, encoding: 'utf8', shell: false });
  if (result.status === 0) return { ok: true, stdout: result.stdout };
  const reason = (result.error?.message ?? result.stderr).trim();
  return { ok: false, problem: `git ${args.join(' ')} failed: ${reason === '' ? `exit status ${String(result.status)}` : reason}` };
}

const nulSeparated = (text: string): readonly string[] => text.split('\0').filter((entry) => entry !== '');

function parseRenames(text: string): readonly Rename[] {
  const fields = nulSeparated(text);
  const renames: Rename[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index] ?? '';
    if (status.startsWith('R') || status.startsWith('C')) {
      const from = fields[index + 1] ?? '';
      const to = fields[index + 2] ?? '';
      if (status.startsWith('R')) renames.push({ from, to });
      index += 2;
    } else {
      index += 1;
    }
  }
  return renames;
}

const unresolved = (cwd: string, baseRef: string): string => {
  const shallow = git(cwd, ['rev-parse', '--is-shallow-repository']);
  const hint =
    shallow.ok && shallow.stdout.trim() === 'true'
      ? ' This clone is shallow, so its history may be too short to reach the merge-base: fetch the whole history.'
      : '';
  return `${baseRef} and HEAD have no merge-base in this clone, so the inherited specs are unknown.${hint}`;
};

export function compareWithBase(cwd: string, baseRef: string): Comparison {
  const base = git(cwd, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${baseRef}^{commit}`]);
  if (!base.ok) {
    return {
      ok: false,
      problem: `${baseRef} does not name a commit here, so there is no baseline to compare with. Fetch it first.`,
    };
  }
  const head = git(cwd, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!head.ok) return head;

  const mergeBase = git(cwd, ['merge-base', base.stdout.trim(), head.stdout.trim()]);
  if (!mergeBase.ok) return { ok: false, problem: unresolved(cwd, baseRef) };

  const [from, to] = [mergeBase.stdout.trim(), head.stdout.trim()];
  const baseline = git(cwd, ['ls-tree', '-r', '-z', '--name-only', from, '--', SPEC_ROOT]);
  if (!baseline.ok) return baseline;
  const current = git(cwd, ['ls-tree', '-r', '-z', '--name-only', to, '--', SPEC_ROOT]);
  if (!current.ok) return current;
  const diff = git(cwd, ['diff', '-z', '--name-status', '-M', '--no-ext-diff', from, to, '--', SPEC_ROOT]);
  if (!diff.ok) return diff;

  return {
    ok: true,
    head: to,
    mergeBase: from,
    classification: classifySpecFiles(
      nulSeparated(baseline.stdout),
      nulSeparated(current.stdout),
      parseRenames(diff.stdout),
    ),
  };
}

const listed = (heading: string, files: readonly string[]): readonly string[] => [
  `${heading} (${String(files.length)}):`,
  ...(files.length === 0 ? ['  none'] : files.map((file) => `  ${file}`)),
];

export function describeComparison(group: Group, baseRef: string, comparison: Comparison & { ok: true }): string {
  const { classification } = comparison;
  return [
    `Advisory group: ${group}.`,
    `Compared ${comparison.head} with its merge-base with ${baseRef}, ${comparison.mergeBase}.`,
    ...listed('Feature specs, spec files added since the merge-base', classification.feature),
    ...listed('Existing specs, spec files the merge-base already had', classification.existing),
    ...listed('Removed spec files, which no group runs and none counts as passing', classification.removed),
  ].join('\n');
}

type Outcome = { readonly status: number; readonly lines: readonly string[] };

type Tally = { passed: number; failed: number; flaky: number; skipped: number };

function tally(specs: readonly ReportSpec[]): Tally {
  const counts: Tally = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const test of specs.flatMap((spec) => spec.tests)) {
    if (test.status === 'expected') counts.passed += 1;
    else if (test.status === 'unexpected') counts.failed += 1;
    else if (test.status === 'flaky') counts.flaky += 1;
    else counts.skipped += 1;
  }
  return counts;
}

function judgeReport(
  group: Group,
  selected: readonly string[],
  specDirectory: string,
  report: LivenessReport,
  exitStatus: number,
): Outcome {
  const specs = specsIn(report.suites);
  const executed = new Set(
    specs.map((spec) => path.relative(specDirectory, path.resolve(report.config.rootDir, spec.file))),
  );
  const wanted = new Set(selected.map((file) => path.relative(SPEC_ROOT, file)));
  const counts = tally(specs);
  const lines = [
    `${LABEL[group]}: ${String(counts.passed)} passed, ${String(counts.failed)} failed, ` +
      `${String(counts.flaky)} flaky, ${String(counts.skipped)} skipped, ` +
      `from ${String(executed.size)} of ${String(wanted.size)} selected spec files.`,
  ];

  const problems = [
    ...report.errors.map((error) => `Playwright reported an error outside any test: ${error.message.split('\n')[0] ?? ''}`),
    ...[...wanted].filter((file) => !executed.has(file)).map((file) => `selected but never run: ${SPEC_ROOT}${file}`),
    ...[...executed].filter((file) => !wanted.has(file)).map((file) => `run but never selected: ${SPEC_ROOT}${file}`),
  ];
  if (problems.length > 0) {
    return {
      status: exitStatus === 0 ? 1 : exitStatus,
      lines: [...lines, `${LABEL[group]} are incomplete:`, ...problems.map((problem) => `  ${problem}`)],
    };
  }
  if (exitStatus !== 0 && counts.failed === 0) {
    return {
      status: exitStatus,
      lines: [...lines, `${LABEL[group]} are incomplete: Playwright exited with status ${String(exitStatus)} and no test failed.`],
    };
  }
  return { status: exitStatus, lines };
}

export type RunOptions = {
  readonly cwd: string;
  readonly group: Group;
  readonly baseRef: string;
  readonly config?: string | undefined;
};

export async function runAdvisoryGroup({ cwd, group, baseRef, config }: RunOptions): Promise<Outcome> {
  const comparison = compareWithBase(cwd, baseRef);
  if (!comparison.ok) {
    return { status: 2, lines: [`${LABEL[group]} were not run: the comparison failed.`, comparison.problem] };
  }
  const selected = comparison.classification[group];
  const header = describeComparison(group, baseRef, comparison);

  if (selected.length === 0) {
    return {
      status: 0,
      lines: [header, `No ${LABEL[group].toLowerCase()} to run, so Playwright was not started. Skipped.`],
    };
  }

  const missing = selected.filter((file) => !existsSync(path.join(cwd, file)));
  if (missing.length > 0) {
    return {
      status: 2,
      lines: [
        header,
        `${LABEL[group]} were not run: the working tree lacks files HEAD has, so the selection is unusable.`,
        ...missing.map((file) => `  ${file}`),
      ],
    };
  }

  const specDirectory = path.join(cwd, SPEC_ROOT);
  const outputDirectory = path.join(cwd, 'test-results', `advisory-${group}`);
  const reportDirectory = path.join(cwd, 'playwright-report', `advisory-${group}`);
  const reportFile = path.join(outputDirectory, 'report.json');
  const listDirectory = mkdtempSync(path.join(tmpdir(), `advisory-${group}-`));
  const listFile = path.join(listDirectory, 'specs.txt');
  writeFileSync(listFile, selected.map((file) => `${path.relative(SPEC_ROOT, file)}\n`).join(''));

  console.log(header);

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const child = spawn(
      path.join(REPO_ROOT, 'node_modules', '.bin', 'playwright'),
      [
        'test',
        '--test-list',
        listFile,
        '--output',
        outputDirectory,
        ...(config === undefined ? [] : ['--config', config]),
      ],
      {
        cwd,
        stdio: 'inherit',
        env: {
          ...process.env,
          E2E_LIVENESS: undefined,
          E2E_ADVISORY: '1',
          PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
          PLAYWRIGHT_HTML_OUTPUT_DIR: reportDirectory,
        },
      },
    );
    const forward = (signal: NodeJS.Signals): void => {
      child.kill(signal);
    };
    process.on('SIGINT', forward).on('SIGTERM', forward);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      process.off('SIGINT', forward).off('SIGTERM', forward);
      resolve({ code, signal });
    });
  }).finally(() => {
    rmSync(listDirectory, { recursive: true, force: true });
  });

  const reports = [
    `HTML report: ${path.relative(cwd, reportDirectory)}`,
    `Traces of failed tests and the JSON report: ${path.relative(cwd, outputDirectory)}`,
  ];
  if (exit.signal !== null || exit.code === null) {
    return {
      status: 1,
      lines: [`${LABEL[group]} are incomplete: Playwright was stopped by ${String(exit.signal)} before it finished.`, ...reports],
    };
  }
  if (!existsSync(reportFile)) {
    return {
      status: exit.code === 0 ? 1 : exit.code,
      lines: [`${LABEL[group]} are incomplete: Playwright wrote no report (exit status ${String(exit.code)}).`],
    };
  }

  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as LivenessReport;
  const outcome = judgeReport(group, selected, specDirectory, report, exit.code);
  return { status: outcome.status, lines: [...outcome.lines, ...reports] };
}

const isGroup = (value: string | undefined): value is Group =>
  GROUPS.some((group) => group === value);

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { base: { type: 'string', default: DEFAULT_BASE }, config: { type: 'string' } },
  });
  const [group] = positionals;
  if (positionals.length !== 1 || !isGroup(group)) {
    console.error(`Usage: run-advisory-specs.ts <${GROUPS.join('|')}> [--base <ref>] [--config <file>]`);
    process.exit(2);
  }

  const outcome = await runAdvisoryGroup({ cwd: process.cwd(), group, baseRef: values.base, config: values.config });
  (outcome.status === 0 ? console.log : console.error)(outcome.lines.join('\n'));
  process.exit(outcome.status);
}
