import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const WORKFLOW = 'e2e-build.yml';

const ARTIFACT = 'playwright-report-advisory-feature';

type Gh = { readonly ok: true; readonly stdout: string } | { readonly ok: false; readonly problem: string };

function gh(args: readonly string[]): Gh {
  const result = spawnSync('gh', [...args], { encoding: 'utf8', shell: false });
  if (result.status === 0) return { ok: true, stdout: result.stdout };
  const reason = (result.error?.message ?? result.stderr).trim();
  return { ok: false, problem: reason === '' ? `exit status ${String(result.status)}` : reason };
}

const findReport = (directory: string): string | undefined =>
  readdirSync(directory, { recursive: true })
    .map(String)
    .find((entry) => path.basename(entry) === 'report.json');

type RunRow = { readonly databaseId?: unknown; readonly headSha?: unknown };

export function findBaseline(branch: string, directory: string): string {
  const listed = gh([
    'run', 'list', '--workflow', WORKFLOW, '--branch', branch, '--event', 'push',
    '--status', 'completed', '--limit', '1', '--json', 'databaseId,headSha',
  ]);
  if (!listed.ok) return `No baseline: listing the completed push runs on ${branch} failed: ${listed.problem}`;

  let latest: RunRow | undefined;
  try {
    [latest] = JSON.parse(listed.stdout) as RunRow[];
  } catch {
    return `No baseline: the list of completed push runs on ${branch} cannot be read.`;
  }
  if (latest === undefined) return `No baseline: ${branch} has no completed push run.`;

  const run = String(latest.databaseId);
  const named = `run ${run} at ${String(latest.headSha)}`;
  const artifactDirectory = path.join(directory, 'artifact');
  mkdirSync(artifactDirectory, { recursive: true });
  const downloaded = gh(['run', 'download', run, '--name', ARTIFACT, '--dir', artifactDirectory]);
  if (!downloaded.ok) {
    return `No baseline: the latest completed push run on ${branch}, ${named}, gave no ${ARTIFACT} artifact: ${downloaded.problem}`;
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
    line = `No baseline: the lookup failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.log(line);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '') appendFileSync(summary, `${line}\n\n`);
}
