import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import stryker from '../stryker.config.ts';
import {
  buildChangeReport,
  DIFF_ARGUMENTS,
  LOCAL_CHANGE_REPORT_JSON,
  LOCAL_CHANGE_REPORT_MARKDOWN,
  LOCAL_REPORT_DIR,
  LOCAL_STRYKER_JSON,
  planLocalRun,
  renderChangeReport,
  type ChangeReport,
  type DiffReader,
} from './change-score.ts';
import { findMergeBase, git } from './run-advisory-specs.ts';

const cwd = process.cwd();

function stop(problem: string): never {
  console.error(problem);
  process.exit(1);
}

const readDiff: DiffReader = (base) => {
  const found = findMergeBase(cwd, base);
  if (!found.ok) return found;

  const scratch = mkdtempSync(path.join(tmpdir(), 'change-score-'));
  try {
    const index = git(cwd, ['rev-parse', '--path-format=absolute', '--git-path', 'index']);
    if (!index.ok) return index;
    const copy = path.join(scratch, 'index');
    if (existsSync(index.stdout.trim())) copyFileSync(index.stdout.trim(), copy);
    const env = { ...process.env, GIT_INDEX_FILE: copy };

    const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
    if (!untracked.ok) return untracked;
    const files = untracked.stdout.split('\0').filter((file) => file !== '');
    if (files.length > 0) {
      const added = git(cwd, ['add', '--intent-to-add', '--', ...files], env);
      if (!added.ok) return added;
    }

    const diff = git(cwd, [...DIFF_ARGUMENTS, found.mergeBase], env);
    return diff.ok ? { ok: true, diff: diff.stdout } : diff;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

const plan = planLocalRun({ args: process.argv.slice(2), mutate: stryker.mutate, readDiff });
if (plan.kind === 'error') stop(`${plan.problem}. Usage: pnpm test:mutation:changed [--base <ref>]`);

rmSync(LOCAL_REPORT_DIR, { recursive: true, force: true });
mkdirSync(LOCAL_REPORT_DIR, { recursive: true });

const startedAt = Date.now();
const elapsedMs = (): number => Date.now() - startedAt;

const measure = (): ChangeReport => {
  let strykerReport: string | undefined = JSON.stringify({ files: {} });
  if (plan.kind === 'run') {
    const config = `${LOCAL_REPORT_DIR}/stryker.config.json`;
    writeFileSync(
      config,
      JSON.stringify({
        ...stryker,
        mutate: plan.mutate,
        reporters: ['progress', 'json'],
        jsonReporter: { fileName: LOCAL_STRYKER_JSON },
        thresholds: { high: stryker.thresholds.high, low: stryker.thresholds.low },
      }),
    );
    const run = spawnSync('pnpm', ['exec', 'stryker', 'run', config], {
      cwd,
      stdio: 'inherit',
      shell: false,
    });
    if (run.status !== 0) {
      return {
        state: 'incomplete',
        reason: `Stryker failed with exit status ${String(run.status)}`,
        elapsedMs: elapsedMs(),
      };
    }
    strykerReport = existsSync(LOCAL_STRYKER_JSON) ? readFileSync(LOCAL_STRYKER_JSON, 'utf8') : undefined;
  }
  return buildChangeReport({
    measureSurface: false,
    report: strykerReport,
    diff: plan.diff,
    mutate: stryker.mutate,
    elapsedMs: elapsedMs(),
  });
};

const report = measure();
const markdown = renderChangeReport(report);
writeFileSync(LOCAL_CHANGE_REPORT_MARKDOWN, markdown);
writeFileSync(LOCAL_CHANGE_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
console.log(markdown);
process.exit(report.state === 'complete' ? 0 : 1);
