import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import stryker from '../stryker.config.ts';
import {
  buildChangeReport,
  LOCAL_CHANGE_REPORT_JSON,
  LOCAL_CHANGE_REPORT_MARKDOWN,
  LOCAL_REPORT_DIR,
  LOCAL_STRYKER_JSON,
  parseLocalArguments,
  planLocalRun,
  renderChangeReport,
} from './change-score.ts';
import { findMergeBase, git } from './run-advisory-specs.ts';

const stop = (problem: string): never => {
  console.error(problem);
  process.exit(1);
};

const cwd = process.cwd();
const args = parseLocalArguments(process.argv.slice(2));
if (!args.ok) stop(`${args.problem}. Usage: pnpm test:mutation:changed [--base <ref>]`);
const base = args.ok ? args.base : '';

const found = findMergeBase(cwd, base);
if (!found.ok) stop(found.problem);
const mergeBase = found.ok ? found.mergeBase : '';

const diff = git(cwd, [
  '-c',
  'core.quotePath=false',
  'diff',
  '--no-color',
  '--no-ext-diff',
  '-U0',
  '-M',
  mergeBase,
]);
if (!diff.ok) stop(diff.problem);
const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
if (!untracked.ok) stop(untracked.problem);

const plan = planLocalRun({
  diff: diff.ok ? diff.stdout : '',
  untracked: (untracked.ok ? untracked.stdout : '').split('\0').filter((file) => file !== ''),
  mutate: stryker.mutate,
});

rmSync(LOCAL_REPORT_DIR, { recursive: true, force: true });
mkdirSync(LOCAL_REPORT_DIR, { recursive: true });

const startedAt = Date.now();
let strykerReport: string | undefined = JSON.stringify({ files: {} });
if (plan.measured.length > 0) {
  const config = `${LOCAL_REPORT_DIR}/stryker.config.json`;
  writeFileSync(
    config,
    JSON.stringify({
      ...stryker,
      mutate: plan.measured,
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
    stop(`Stryker failed with exit status ${String(run.status)}. There is no Change score for this run.`);
  }
  strykerReport = existsSync(LOCAL_STRYKER_JSON) ? readFileSync(LOCAL_STRYKER_JSON, 'utf8') : undefined;
}

const report = buildChangeReport({
  scope: 'local',
  report: strykerReport,
  diff: plan.diff,
  mutate: stryker.mutate,
  elapsedMs: Date.now() - startedAt,
});
const markdown = renderChangeReport(report);
writeFileSync(LOCAL_CHANGE_REPORT_MARKDOWN, markdown);
writeFileSync(LOCAL_CHANGE_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);

if (report.state === 'incomplete') {
  stop(`Incomplete: ${report.reason}. There is no Change score for this run.`);
}
console.log(markdown);
