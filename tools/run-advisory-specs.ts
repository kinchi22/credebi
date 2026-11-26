import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SPEC_ROOT } from './check-pr-isolation.ts';
import {
  type LivenessReport,
  noReport,
  type ReportSpec,
  type ReportSuite,
  runPlaywright,
  specsIn,
} from './verify-e2e-liveness.ts';

const GROUPS = ['existing', 'feature'] as const;

export type Group = (typeof GROUPS)[number];

const DEFAULT_BASE = 'origin/main';

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

const isRunnableSpec = (file: string): boolean =>
  file.startsWith(SPEC_ROOT) && /\.(spec|test)\.[cm]?[jt]sx?$/.test(file);

export function classifySpecFiles(
  baseline: readonly string[],
  current: readonly string[],
  renames: readonly Rename[],
): Classification {
  const inherited = new Set(baseline.filter(isRunnableSpec));
  const present = new Set(current.filter(isRunnableSpec));
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

export type GitResult = { readonly ok: true; readonly stdout: string } | { readonly ok: false; readonly problem: string };

export function git(
  cwd: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): GitResult {
  const result = spawnSync('git', [...args], {
    cwd,
    env,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
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
  return `${baseRef} and HEAD have no merge-base in this clone.${hint}`;
};

export type MergeBase =
  | { readonly ok: true; readonly head: string; readonly mergeBase: string }
  | { readonly ok: false; readonly problem: string };

export function findMergeBase(cwd: string, baseRef: string): MergeBase {
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
  return { ok: true, head: head.stdout.trim(), mergeBase: mergeBase.stdout.trim() };
}

export function compareWithBase(cwd: string, baseRef: string): Comparison {
  const found = findMergeBase(cwd, baseRef);
  if (!found.ok) return found;

  const [from, to] = [found.mergeBase, found.head];
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

function describeComparison(group: Group, baseRef: string, comparison: Comparison & { ok: true }): string {
  const { classification } = comparison;
  return [
    `Advisory group: ${group}.`,
    `Compared ${comparison.head} with its merge-base with ${baseRef}, ${comparison.mergeBase}.`,
    ...listed('Feature specs, spec files added since the merge-base', classification.feature),
    ...listed('Existing specs, spec files the merge-base already had', classification.existing),
    ...listed('Removed spec files, which no group runs and none counts as passing', classification.removed),
  ].join('\n');
}

type TestState = 'passed' | 'failed' | 'flaky' | 'skipped';

const stateOfStatus = (status: string): TestState => {
  if (status === 'expected') return 'passed';
  if (status === 'unexpected') return 'failed';
  if (status === 'flaky') return 'flaky';
  return 'skipped';
};

const WORST_FIRST: readonly TestState[] = ['failed', 'flaky', 'skipped', 'passed'];

type NamedState = { readonly name: string; readonly state: TestState };

function testStatesIn(suites: readonly ReportSuite[]): ReadonlyMap<string, NamedState> {
  const states = new Map<string, NamedState>();
  const visit = (suite: ReportSuite, titles: readonly string[]): void => {
    for (const spec of suite.specs) {
      const projects = new Set(spec.tests.map((test) => test.projectName ?? ''));
      for (const project of projects) {
        const found = spec.tests.filter((test) => (test.projectName ?? '') === project).map((test) => stateOfStatus(test.status));
        const state = WORST_FIRST.find((candidate) => found.includes(candidate));
        const path = [spec.file, ...titles, spec.title];
        if (state !== undefined) {
          states.set(JSON.stringify([...path, project]), {
            name: `${path.join(' > ')}${project === '' ? '' : ` [${project}]`}`,
            state,
          });
        }
      }
    }
    for (const nested of suite.suites ?? []) {
      visit(nested, [...titles, ...(nested.title === undefined ? [] : [nested.title])]);
    }
  };
  for (const fileSuite of suites) visit(fileSuite, []);
  return states;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWellFormedSuite = (value: unknown): value is ReportSuite =>
  isRecord(value) &&
  (value['title'] === undefined || typeof value['title'] === 'string') &&
  Array.isArray(value['specs']) &&
  value['specs'].every(
    (spec) =>
      isRecord(spec) &&
      typeof spec['title'] === 'string' &&
      typeof spec['file'] === 'string' &&
      Array.isArray(spec['tests']) &&
      spec['tests'].every(
        (test) =>
          isRecord(test) &&
          typeof test['status'] === 'string' &&
          (test['projectName'] === undefined || typeof test['projectName'] === 'string'),
      ),
  ) &&
  (value['suites'] === undefined || (Array.isArray(value['suites']) && value['suites'].every(isWellFormedSuite)));

type BaselineRead =
  | { readonly ok: true; readonly suites: readonly ReportSuite[] }
  | { readonly ok: false; readonly problem: string };

function readBaseline(file: string): BaselineRead {
  if (!existsSync(file)) return { ok: false, problem: `${file} does not exist` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { ok: false, problem: `${file} cannot be read as JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const suites = isRecord(parsed) ? parsed['suites'] : undefined;
  if (!Array.isArray(suites)) return { ok: false, problem: `${file} is not a Playwright JSON report` };
  if (!suites.every(isWellFormedSuite)) return { ok: false, problem: `${file} has suites or specs that are not those of a Playwright JSON report` };
  return { ok: true, suites };
}

type TestChange = { readonly test: string; readonly baseline: TestState | undefined; readonly run: TestState | undefined };

const NEW_HEADING = 'New, absent from the baseline';

const GONE_HEADING = 'Gone, on the baseline and absent from this run';

const changeLines = (heading: string, changes: readonly TestChange[]): readonly string[] => [
  `${heading} (${String(changes.length)}):`,
  ...(changes.length === 0
    ? ['  none']
    : changes.map(({ test, baseline, run }) => `  ${test}: baseline ${baseline ?? 'none'}, this run ${run ?? 'none'}`)),
];

const CHANGE_GROUPS = ['Turned to passing', 'Turned to failing', 'Unchanged', 'Other change'] as const;

function changeGroup(was: TestState, run: TestState): (typeof CHANGE_GROUPS)[number] {
  if (was === run) return 'Unchanged';
  if (run === 'passed') return 'Turned to passing';
  if (was === 'passed' && run === 'failed') return 'Turned to failing';
  return 'Other change';
}

export function compareWithBaseline(baselineFile: string, report: LivenessReport): readonly string[] {
  const baseline = readBaseline(baselineFile);
  const current = testStatesIn(report.suites);
  const byName = (a: TestChange, b: TestChange): number => a.test.localeCompare(b.test);

  if (!baseline.ok) {
    const everyTest = [...current.values()].map(({ name, state }) => ({ test: name, baseline: undefined, run: state }));
    return [
      `No baseline: ${baseline.problem}. Nothing is compared, so every test is new and no test counts as turned to passing.`,
      ...changeLines(NEW_HEADING, everyTest.sort(byName)),
    ];
  }

  const before = testStatesIn(baseline.suites);
  const grouped = new Map<string, TestChange[]>([...CHANGE_GROUPS, NEW_HEADING, GONE_HEADING].map((group) => [group, []]));
  for (const [key, now] of current) {
    const was = before.get(key);
    const group = was === undefined ? NEW_HEADING : changeGroup(was.state, now.state);
    grouped.get(group)?.push({ test: now.name, baseline: was?.state, run: now.state });
  }
  for (const [key, was] of before) {
    if (!current.has(key)) grouped.get(GONE_HEADING)?.push({ test: was.name, baseline: was.state, run: undefined });
  }
  return [
    'Comparison with the baseline report:',
    ...[...grouped].flatMap(([group, changes]) => changeLines(group, changes.sort(byName))),
  ];
}

type Outcome = { readonly status: number; readonly lines: readonly string[] };

type Tally = { passed: number; failed: number; flaky: number; skipped: number };

function tally(specs: readonly ReportSpec[]): Tally {
  const counts: Tally = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const test of specs.flatMap((spec) => spec.tests)) counts[stateOfStatus(test.status)] += 1;
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

type RunOptions = {
  readonly cwd: string;
  readonly group: Group;
  readonly baseRef: string;
  readonly config?: string | undefined;
  readonly baseline?: string | undefined;
};

export async function runAdvisoryGroup({ cwd, group, baseRef, config, baseline }: RunOptions): Promise<Outcome> {
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

  const outputDirectory = path.join(cwd, 'test-results', `advisory-${group}`);
  const reportDirectory = path.join(cwd, 'playwright-report', `advisory-${group}`);
  const reportFile = path.join(outputDirectory, 'report.json');
  const listDirectory = mkdtempSync(path.join(tmpdir(), `advisory-${group}-`));
  const listFile = path.join(listDirectory, 'specs.txt');
  writeFileSync(listFile, selected.map((file) => `${path.relative(SPEC_ROOT, file)}\n`).join(''));

  console.log(header);

  const run = await runPlaywright({
    cwd,
    args: ['--test-list', listFile, '--output', outputDirectory, ...(config === undefined ? [] : ['--config', config])],
    env: { E2E_LIVENESS: undefined, E2E_ADVISORY: '1', PLAYWRIGHT_HTML_OUTPUT_DIR: reportDirectory },
    reportFile,
  }).finally(() => {
    rmSync(listDirectory, { recursive: true, force: true });
  });

  if (run.report === undefined || run.exitStatus === null) {
    return { status: run.exitStatus === null || run.exitStatus === 0 ? 1 : run.exitStatus, lines: [`${LABEL[group]} are incomplete: ${noReport(run)}`] };
  }

  const outcome = judgeReport(group, selected, path.join(cwd, SPEC_ROOT), run.report, run.exitStatus);
  return {
    status: outcome.status,
    lines: [
      ...outcome.lines,
      ...(baseline === undefined ? [] : compareWithBaseline(path.resolve(cwd, baseline), run.report)),
      `HTML report: ${path.relative(cwd, reportDirectory)}`,
      `Traces of failed tests and the JSON report: ${path.relative(cwd, outputDirectory)}`,
    ],
  };
}

const isGroup = (value: string | undefined): value is Group =>
  GROUPS.some((group) => group === value);

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { base: { type: 'string', default: DEFAULT_BASE }, config: { type: 'string' }, baseline: { type: 'string' } },
  });
  const [group] = positionals;
  if (positionals.length !== 1 || !isGroup(group)) {
    console.error(`Usage: run-advisory-specs.ts <${GROUPS.join('|')}> [--base <ref>] [--config <file>] [--baseline <report.json>]`);
    process.exit(2);
  }

  const outcome = await runAdvisoryGroup({ cwd: process.cwd(), group, baseRef: values.base, config: values.config, baseline: values.baseline });
  (outcome.status === 0 ? console.log : console.error)(outcome.lines.join('\n'));
  process.exit(outcome.status);
}
