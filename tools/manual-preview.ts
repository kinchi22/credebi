import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function git(args: string[], directory: string): string {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('The requested repository target cannot be resolved.');
  return result.stdout.trim();
}

export function resolvePreviewTarget(target: string, directory: string): string {
  if (/^[a-f\d]{40}$/i.test(target)) {
    const sha = git(['rev-parse', '--verify', `${target}^{commit}`], directory);
    const branches = git(['for-each-ref', '--contains', sha, '--format=%(refname)', 'refs/remotes/origin/'], directory);
    if (!branches.split('\n').some((branch) => branch !== 'refs/remotes/origin/HEAD' && branch.startsWith('refs/remotes/origin/'))) {
      throw new Error('The commit is not reachable from a repository branch.');
    }
    return sha;
  }
  if (!target || target !== target.trim() || /^\d+$/.test(target) || target.startsWith('refs/') || target.startsWith('-') || target.includes(':') || /\s/.test(target)) {
    throw new Error('Request a repository branch name or full commit SHA.');
  }
  git(['check-ref-format', `refs/heads/${target}`], directory);
  const reference = `refs/remotes/origin/${target}`;
  if (git(['for-each-ref', '--format=%(symref)', reference], directory)) {
    throw new Error('Request a repository branch, not a symbolic default reference.');
  }
  return git(['rev-parse', '--verify', `${reference}^{commit}`], directory);
}

export function deployPreview(sha: string, directory: string, executable = 'vercel', environment = process.env): string {
  if (!/^[a-f\d]{40}$/.test(sha) || git(['rev-parse', 'HEAD'], directory) !== sha) {
    throw new Error('The checkout does not match the approved commit.');
  }
  git(['diff', '--exit-code', 'HEAD'], directory);
  if (!environment['VERCEL_TOKEN']) throw new Error('VERCEL_TOKEN is required.');
  const deployment = spawnSync(executable, ['deploy', '--yes', '--target', 'preview', '--meta', `githubCommitSha=${sha}`], {
    cwd: directory,
    env: { ...environment, VERCEL_ORG_ID: 'team_07kD2sI9Uk9JGYqpTxvJH1hz', VERCEL_PROJECT_ID: 'prj_wkKYEhdp7eQ0LWJ9RJfGsRSGp8s5' },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (deployment.status !== 0) throw new Error('Preview build or deployment failed; inspect the deployment logs in Vercel.');
  const value = deployment.stdout.trim();
  if (!isPreviewUrl(value)) throw new Error('The deployment did not return a valid Preview URL.');
  return value;
}

function isPreviewUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === 'https:' && url.origin === value && url.hostname.endsWith('.vercel.app');
}

async function postToGitHub(resource: string, body: Record<string, unknown>, environment: NodeJS.ProcessEnv): Promise<unknown> {
  const response = await fetch(`${environment['GITHUB_API_URL'] ?? 'https://api.github.com'}/repos/${environment['GITHUB_REPOSITORY'] ?? ''}/${resource}`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${environment['GITHUB_TOKEN'] ?? ''}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (response.status !== 201) throw new Error(`GitHub refused the Preview deployment record with status ${String(response.status)}.`);
  return response.json();
}

function runUrl(environment: NodeJS.ProcessEnv): string {
  return `${environment['GITHUB_SERVER_URL'] ?? 'https://github.com'}/${environment['GITHUB_REPOSITORY'] ?? ''}/actions/runs/${environment['GITHUB_RUN_ID'] ?? ''}`;
}

export async function startPreviewRecord(sha: string, environment = process.env): Promise<string> {
  if (!/^[a-f\d]{40}$/.test(sha)) throw new Error('Only a full approved commit SHA can be recorded.');
  const created = await postToGitHub('deployments', {
    ref: sha,
    environment: 'Preview',
    auto_merge: false,
    required_contexts: [],
    production_environment: false,
    transient_environment: false,
    description: `Manual Preview of ${sha}`,
  }, environment);
  const id = (created as { id?: unknown }).id;
  if (typeof id !== 'number') throw new Error('GitHub returned no Preview deployment record.');
  await postToGitHub(`deployments/${String(id)}/statuses`, { state: 'in_progress', log_url: runUrl(environment) }, environment);
  return String(id);
}

export async function finishPreviewRecord(id: string, outcome: string, url: string, environment = process.env): Promise<void> {
  if (!/^\d+$/.test(id)) throw new Error('There is no Preview deployment record to finish.');
  const succeeded = outcome === 'success' && isPreviewUrl(url);
  await postToGitHub(`deployments/${id}/statuses`, {
    state: succeeded ? 'success' : 'failure',
    log_url: runUrl(environment),
    ...(succeeded ? { environment_url: url } : {}),
    auto_inactive: true,
  }, environment);
}

export function renderPreviewSummary(target: string, sha: string, status: string, url?: string): string {
  const escapedTarget = target.replace(/[&<>`\r\n]/g, (character) => `&#${String(character.charCodeAt(0))};`);
  return `## Preview deployment\n\nRequested target: ${escapedTarget}\n\nResolved commit: ${sha || 'Unresolved'}\n\nStatus: ${status}\n\n${url ? `Preview URL: ${url}\n` : ''}`;
}

async function main(mode: string | undefined): Promise<void> {
  const target = process.env['REQUESTED_TARGET'] ?? '';
  const directory = process.env['SOURCE_DIRECTORY'] ?? '.';
  if (mode === 'resolve') {
    const sha = resolvePreviewTarget(target, directory);
    appendFileSync(process.env['GITHUB_OUTPUT'] ?? '/dev/stdout', `sha=${sha}\n`);
    appendFileSync(process.env['GITHUB_STEP_SUMMARY'] ?? '/dev/stdout', `Resolved Preview commit: \`${sha}\`\n\nReview this SHA before approving the Preview environment.\n`);
  } else if (mode === 'record-start') {
    const id = await startPreviewRecord(process.env['APPROVED_SHA'] ?? '');
    appendFileSync(process.env['GITHUB_OUTPUT'] ?? '/dev/stdout', `id=${id}\n`);
  } else if (mode === 'deploy') {
    const url = deployPreview(process.env['APPROVED_SHA'] ?? '', directory);
    appendFileSync(process.env['GITHUB_OUTPUT'] ?? '/dev/stdout', `url=${url}\n`);
  } else if (mode === 'record-finish') {
    await finishPreviewRecord(process.env['DEPLOYMENT_ID'] ?? '', process.env['DEPLOY_OUTCOME'] ?? '', process.env['PREVIEW_URL'] ?? '');
  } else if (mode === 'summary') {
    const status = process.env['RESOLUTION_RESULT'] === 'success' && process.env['DEPLOYMENT_RESULT'] === 'success' ? 'success' : 'failure';
    appendFileSync(process.env['GITHUB_STEP_SUMMARY'] ?? '/dev/stdout', renderPreviewSummary(target, process.env['APPROVED_SHA'] ?? '', status, process.env['PREVIEW_URL']));
    if (status !== 'success') process.exitCode = 1;
  } else {
    throw new Error('Choose resolve, record-start, deploy, record-finish or summary.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await main(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Preview request failed.');
    process.exitCode = 1;
  }
}
