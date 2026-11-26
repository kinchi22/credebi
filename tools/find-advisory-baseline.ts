import { appendFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { runGh } from './gh.ts';

const WORKFLOW = 'e2e-build.yml';

const ARTIFACT = 'playwright-report-advisory-feature';

const message = (error: unknown): string => (error instanceof Error ? error.message.trim() : String(error));

const findReport = (directory: string): string | undefined =>
  readdirSync(directory, { recursive: true })
    .map(String)
    .find((entry) => path.basename(entry) === 'report.json');

type Run = { readonly databaseId: number; readonly headSha: string };

const isRun = (value: unknown): value is Run =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Run).databaseId === 'number' &&
  typeof (value as Run).headSha === 'string';

function findBaseline(branch: string, directory: string): string {
  let rows: unknown;
  try {
    rows = JSON.parse(
      runGh(
        [
          'run', 'list', '--workflow', WORKFLOW, '--branch', branch, '--event', 'push',
          '--status', 'completed', '--limit', '1', '--json', 'databaseId,headSha',
        ],
        process.env,
      ),
    );
  } catch (error) {
    return `No baseline: listing the completed push runs on ${branch} failed: ${message(error)}`;
  }
  if (!Array.isArray(rows) || rows.length === 0) return `No baseline: ${branch} has no completed push run.`;
  const latest: unknown = rows[0];
  if (!isRun(latest)) return `No baseline: the list of completed push runs on ${branch} cannot be read.`;

  const named = `run ${String(latest.databaseId)} at ${latest.headSha}`;
  const artifactDirectory = path.join(directory, 'artifact');
  mkdirSync(artifactDirectory, { recursive: true });
  try {
    runGh(['run', 'download', String(latest.databaseId), '--name', ARTIFACT, '--dir', artifactDirectory], process.env);
  } catch (error) {
    return `No baseline: the latest completed push run on ${branch}, ${named}, gave no ${ARTIFACT} artifact: ${message(error)}`;
  }
  const report = findReport(artifactDirectory);
  if (report === undefined) return `No baseline: ${ARTIFACT} of ${named} holds no report.json.`;
  copyFileSync(path.join(artifactDirectory, report), path.join(directory, 'report.json'));
  return `Baseline: the JSON report of ${named}, the latest completed push run on ${branch}.`;
}

if (import.meta.main) {
  const [branch, directory] = process.argv.slice(2);
  if (branch === undefined || directory === undefined) {
    console.error('Usage: find-advisory-baseline.ts <base branch> <directory>');
    process.exit(2);
  }
  let line: string;
  try {
    mkdirSync(directory, { recursive: true });
    line = findBaseline(branch, directory);
  } catch (error) {
    line = `No baseline: the lookup failed: ${message(error)}`;
  }
  console.log(line);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '') appendFileSync(summary, `${line}\n\n`);
}
