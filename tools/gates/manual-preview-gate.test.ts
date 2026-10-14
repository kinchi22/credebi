import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolvePreviewTarget } from '../manual-preview';

const directories: string[] = [];

function repository() {
  const directory = mkdtempSync(path.join(tmpdir(), 'manual-preview-'));
  directories.push(directory);
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Preview test');
  git('config', 'user.email', 'preview@example.com');
  git('commit', '--allow-empty', '-m', 'first');
  const first = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', first);
  git('update-ref', 'refs/remotes/origin/feature/nested', first);
  git('tag', 'release');
  git('tag', 'main');
  git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  return { directory, git, first };
}

const servers: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  for (const close of servers.splice(0)) await close();
});

interface ReceivedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: Record<string, unknown>;
}

async function fakeGitHub(creationStatus = 201) {
  const requests: ReceivedRequest[] = [];
  const server = createServer((request, response) => {
    let text = '';
    request.on('data', (chunk: Buffer) => (text += chunk.toString()));
    request.on('end', () => {
      requests.push({ method: request.method ?? '', path: request.url ?? '', headers: request.headers, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} });
      const creating = request.url === '/repos/kinchi22/credebi/deployments';
      response.writeHead(creating ? creationStatus : 201, { 'content-type': 'application/json' });
      response.end(JSON.stringify(creating ? (creationStatus === 201 ? { id: 4242 } : { message: 'Conflict' }) : { id: 1 }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(() => new Promise((resolve) => server.close(() => { resolve(); })));
  return { url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`, requests };
}

function runTool(mode: string, environment: NodeJS.ProcessEnv) {
  const script = path.resolve(import.meta.dirname, '../manual-preview.ts');
  return new Promise<{ status: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, [script, mode], { env: environment });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('close', (status) => { resolve({ status, output }); });
  });
}

const approvedSha = 'b'.repeat(40);
const runUrl = 'https://github.com/kinchi22/credebi/actions/runs/777';
const vercelToken = 'vercel-secret-never-sent';

function recordEnvironment(apiUrl: string, outputFile: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env['PATH'],
    GITHUB_API_URL: apiUrl,
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'kinchi22/credebi',
    GITHUB_RUN_ID: '777',
    GITHUB_TOKEN: 'github-fixture-token',
    GITHUB_OUTPUT: outputFile,
    VERCEL_TOKEN: vercelToken,
    APPROVED_SHA: approvedSha,
    ...extra,
  };
}

describe('manual Preview target resolution', () => {
  it('resolves repository branches and full SHAs, freezing a branch before it moves', () => {
    const { directory, git, first } = repository();
    expect(resolvePreviewTarget('main', directory)).toBe(first);
    const approved = resolvePreviewTarget('feature/nested', directory);
    git('commit', '--allow-empty', '-m', 'second');
    git('update-ref', 'refs/remotes/origin/feature/nested', git('rev-parse', 'HEAD'));
    expect(approved).toBe(first);
    expect(resolvePreviewTarget(first, directory)).toBe(first);
  });

  it.each(['release', '123', '#123', 'refs/tags/release', 'refs/pull/1/head', 'owner:main', 'https://example.com/repo', '', ' main', '-main', 'HEAD', 'abcdef123', 'main\nother', 'missing'])('rejects unsupported or unresolved target %j without fallback', (target) => {
    const { directory } = repository();
    expect(() => resolvePreviewTarget(target, directory)).toThrow();
  });

  it('rejects a commit that is not reachable from a repository branch', () => {
    const { directory, git } = repository();
    git('commit', '--allow-empty', '-m', 'unpublished');
    expect(() => resolvePreviewTarget(git('rev-parse', 'HEAD'), directory)).toThrow();
  });
});

describe('manual Preview deployment outcomes', () => {
  it('deploys the approved commit to Preview on every invocation and returns its URL', async () => {
    const { directory, first } = repository();
    const executable = path.join(directory, 'vercel');
    const output = path.join(directory, 'deployments.jsonl');
    writeFileSync(executable, '#!/usr/bin/env node\nconst fs = require("node:fs"); fs.appendFileSync(process.env.DEPLOYMENT_RECORD, JSON.stringify({args:process.argv.slice(2),project:process.env.VERCEL_PROJECT_ID,team:process.env.VERCEL_ORG_ID})+"\\n"); console.log("https://credebi-example.vercel.app");\n');
    chmodSync(executable, 0o755);
    const { deployPreview } = await import('../manual-preview');
    const environment = { ...process.env, VERCEL_TOKEN: 'fixture', DEPLOYMENT_RECORD: output };
    expect(deployPreview(first, directory, executable, environment)).toBe('https://credebi-example.vercel.app');
    expect(deployPreview(first, directory, executable, environment)).toBe('https://credebi-example.vercel.app');
    const records = readFileSync(output, 'utf8').trim().split('\n').map((line: string) => JSON.parse(line) as { args: string[]; project: string; team: string });
    expect(records).toHaveLength(2);
    for (const record of records) {
      expect(record.args).toEqual(['deploy', '--yes', '--target', 'preview', '--meta', `githubCommitSha=${first}`]);
      expect(record.project).toBe('prj_wkKYEhdp7eQ0LWJ9RJfGsRSGp8s5');
      expect(record.team).toBe('team_07kD2sI9Uk9JGYqpTxvJH1hz');
    }
  });

  it('fails instead of deploying a changed checkout or reporting a failed build as successful', async () => {
    const { directory, git, first } = repository();
    const { deployPreview } = await import('../manual-preview');
    git('commit', '--allow-empty', '-m', 'changed');
    expect(() => deployPreview(first, directory, '/bin/false', { VERCEL_TOKEN: 'fixture' })).toThrow('approved');
    expect(() => deployPreview(git('rev-parse', 'HEAD'), directory, '/bin/false', { VERCEL_TOKEN: 'fixture' })).toThrow('failed');
  });

  it('renders success and failure summaries with the requested target and frozen SHA', async () => {
    const { renderPreviewSummary } = await import('../manual-preview');
    const sha = 'a'.repeat(40);
    expect(renderPreviewSummary('main', sha, 'success', 'https://example.vercel.app')).toContain('https://example.vercel.app');
    const failure = renderPreviewSummary('feature/nested', sha, 'failure');
    expect(failure).toContain('feature/nested');
    expect(failure).toContain(sha);
    expect(failure).toContain('failure');
    expect(renderPreviewSummary('missing', '', 'failure')).toContain('Unresolved');
  });
});

describe('manual Preview deployment record', () => {
  it('creates the record for the approved SHA in Preview and marks it in progress, linked to the run, before Vercel deploys', async () => {
    const github = await fakeGitHub();
    const directory = mkdtempSync(path.join(tmpdir(), 'manual-preview-record-'));
    directories.push(directory);
    const outputFile = path.join(directory, 'output');
    const started = await runTool('record-start', recordEnvironment(github.url, outputFile));
    expect(started.status).toBe(0);
    expect(readFileSync(outputFile, 'utf8')).toBe('id=4242\n');
    expect(github.requests.map((request) => `${request.method} ${request.path}`)).toEqual(['POST /repos/kinchi22/credebi/deployments', 'POST /repos/kinchi22/credebi/deployments/4242/statuses']);
    expect(github.requests[0]?.body).toEqual({
      ref: approvedSha,
      environment: 'Preview',
      auto_merge: false,
      required_contexts: [],
      production_environment: false,
      transient_environment: false,
      description: `Manual Preview of ${approvedSha}`,
    });
    expect(github.requests[1]?.body).toEqual({ state: 'in_progress', log_url: runUrl });
    for (const request of github.requests) expect(request.headers.authorization).toBe('Bearer github-fixture-token');
    expect(JSON.stringify(github.requests)).not.toContain(vercelToken);
    expect(started.output).not.toContain(vercelToken);
  });

  it('records a successful deployment with its Preview URL and makes earlier Preview records inactive', async () => {
    const github = await fakeGitHub();
    const outputFile = path.join(tmpdir(), 'unused-output');
    const finished = await runTool('record-finish', recordEnvironment(github.url, outputFile, { DEPLOYMENT_ID: '4242', DEPLOY_OUTCOME: 'success', PREVIEW_URL: 'https://credebi-example.vercel.app' }));
    expect(finished.status).toBe(0);
    expect(github.requests.map((request) => `${request.method} ${request.path}`)).toEqual(['POST /repos/kinchi22/credebi/deployments/4242/statuses']);
    expect(github.requests[0]?.body).toEqual({ state: 'success', log_url: runUrl, environment_url: 'https://credebi-example.vercel.app', auto_inactive: true });
    expect(JSON.stringify(github.requests)).not.toContain(vercelToken);
    expect(finished.output).not.toContain(vercelToken);
  });

  it.each([
    ['failure', 'https://credebi-example.vercel.app'],
    ['cancelled', 'https://credebi-example.vercel.app'],
    ['skipped', ''],
    ['success', ''],
    ['success', 'https://example.com'],
    ['success', 'http://credebi-example.vercel.app'],
    ['success', 'https://credebi-example.vercel.app/path'],
  ])('records a %s deploy with URL %j as failure, never success', async (outcome, url) => {
    const github = await fakeGitHub();
    const finished = await runTool('record-finish', recordEnvironment(github.url, path.join(tmpdir(), 'unused-output'), { DEPLOYMENT_ID: '4242', DEPLOY_OUTCOME: outcome, PREVIEW_URL: url }));
    expect(finished.status).toBe(0);
    expect(github.requests.map((request) => request.body)).toEqual([{ state: 'failure', log_url: runUrl, auto_inactive: true }]);
  });

  it('moves one record through in progress to its final state in order', async () => {
    const github = await fakeGitHub();
    const directory = mkdtempSync(path.join(tmpdir(), 'manual-preview-record-'));
    directories.push(directory);
    const outputFile = path.join(directory, 'output');
    expect((await runTool('record-start', recordEnvironment(github.url, outputFile))).status).toBe(0);
    const id = /^id=(\d+)$/m.exec(readFileSync(outputFile, 'utf8'))?.[1];
    expect((await runTool('record-finish', recordEnvironment(github.url, outputFile, { DEPLOYMENT_ID: id, DEPLOY_OUTCOME: 'success', PREVIEW_URL: 'https://credebi-example.vercel.app' }))).status).toBe(0);
    expect(github.requests.map((request) => request.body['state'] ?? request.body['ref'])).toEqual([approvedSha, 'in_progress', 'success']);
  });

  it('fails without a status or an id when GitHub does not create the record', async () => {
    const github = await fakeGitHub(409);
    const directory = mkdtempSync(path.join(tmpdir(), 'manual-preview-record-'));
    directories.push(directory);
    const outputFile = path.join(directory, 'output');
    const started = await runTool('record-start', recordEnvironment(github.url, outputFile));
    expect(started.status).toBe(1);
    expect(github.requests).toHaveLength(1);
    expect(existsSync(outputFile)).toBe(false);
  });

  it('refuses to record anything but a full approved SHA', async () => {
    const github = await fakeGitHub();
    const started = await runTool('record-start', recordEnvironment(github.url, path.join(tmpdir(), 'unused-output'), { APPROVED_SHA: 'main' }));
    expect(started.status).toBe(1);
    expect(github.requests).toHaveLength(0);
  });

  it('fails the final step when there is no record to finish', async () => {
    const github = await fakeGitHub();
    const finished = await runTool('record-finish', recordEnvironment(github.url, path.join(tmpdir(), 'unused-output'), { DEPLOYMENT_ID: '', DEPLOY_OUTCOME: 'failure' }));
    expect(finished.status).toBe(1);
    expect(github.requests).toHaveLength(0);
  });
});

it('keeps approval and the token after resolution, uses the frozen checkout, and remains manual', () => {
  const workflow = readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/manual-preview.yml'), 'utf8');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).not.toMatch(/^ {2}(push|pull_request|workflow_call|schedule):/m);
  expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  const resolve = workflow.slice(workflow.indexOf('  resolve:'), workflow.indexOf('  deploy:'));
  expect(resolve).not.toContain('VERCEL_TOKEN');
  const deploy = workflow.slice(workflow.indexOf('  deploy:'), workflow.indexOf('  summary:'));
  expect(deploy).toContain('needs: resolve');
  expect(deploy).toMatch(/environment:\n {6}name: Preview\n {6}deployment: false\n/);
  expect(workflow).not.toContain('preview-deployment');
  expect(deploy).toContain('name: Deploy approved ${{ needs.resolve.outputs.sha }} to Preview');
  expect(deploy).toContain('ref: ${{ needs.resolve.outputs.sha }}');
  expect(deploy).toContain('path: source');
  expect(deploy).toContain('APPROVED_SHA: ${{ needs.resolve.outputs.sha }}');
  expect(deploy).toContain('VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}');
  expect(deploy).toContain('node tooling/tools/manual-preview.ts deploy');
  expect(workflow).toContain('if: always()');
  expect(workflow.match(/deployments: write/g)).toHaveLength(1);
  expect(deploy).toMatch(/permissions:\n {6}contents: read\n {6}deployments: write\n/);
  const steps = deploy.split(/\n {6}- /);
  const tokenSteps = steps.filter((step) => step.includes('VERCEL_TOKEN'));
  expect(tokenSteps).toHaveLength(1);
  expect(tokenSteps[0]).toContain('node tooling/tools/manual-preview.ts deploy');
  expect(workflow.match(/VERCEL_TOKEN/g)).toHaveLength(2);
  const recordStart = steps.findIndex((step) => step.includes('manual-preview.ts record-start'));
  const vercel = steps.findIndex((step) => step.includes('manual-preview.ts deploy'));
  const recordFinish = steps.findIndex((step) => step.includes('manual-preview.ts record-finish'));
  expect(recordStart).toBeGreaterThan(0);
  expect(recordStart).toBeLessThan(vercel);
  expect(recordFinish).toBeGreaterThan(vercel);
  expect(steps[recordFinish]).toMatch(/^name: [^\n]+\n {8}if: always\(\)\n/);
  for (const step of [steps[recordStart], steps[recordFinish]]) expect(step).toContain('GITHUB_TOKEN: ${{ github.token }}');
  expect(steps[vercel]).not.toContain('GITHUB_TOKEN');
  expect(workflow).not.toMatch(/--prod|promote|rollback|--force|--prebuilt/);
  const workflows = ['ci.yml', 'e2e-build.yml'];
  for (const name of workflows) expect(readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows', name), 'utf8')).not.toContain('manual-preview');
});


it('emits the resolved SHA before approval and returns failed summary exit status after deployment failure', () => {
  const { directory, first } = repository();
  const output = path.join(directory, 'output');
  const summary = path.join(directory, 'summary');
  const script = path.resolve(import.meta.dirname, '../manual-preview.ts');
  const environment = { ...process.env, SOURCE_DIRECTORY: directory, REQUESTED_TARGET: 'main', GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary };
  const resolved = spawnSync(process.execPath, [script, 'resolve'], { env: environment, encoding: 'utf8' });
  expect(resolved.status).toBe(0);
  expect(readFileSync(output, 'utf8')).toBe(`sha=${first}\n`);
  expect(readFileSync(summary, 'utf8')).toContain(first);
  const failed = spawnSync(process.execPath, [script, 'summary'], { env: { ...environment, APPROVED_SHA: first, RESOLUTION_RESULT: 'success', DEPLOYMENT_RESULT: 'failure' }, encoding: 'utf8' });
  expect(failed.status).toBe(1);
  expect(readFileSync(summary, 'utf8')).toContain('Status: failure');
  const succeeded = spawnSync(process.execPath, [script, 'summary'], { env: { ...environment, APPROVED_SHA: first, RESOLUTION_RESULT: 'success', DEPLOYMENT_RESULT: 'success', PREVIEW_URL: 'https://credebi-example.vercel.app' }, encoding: 'utf8' });
  expect(succeeded.status).toBe(0);
  expect(readFileSync(summary, 'utf8')).toContain('Preview URL: https://credebi-example.vercel.app');
  const invalid = spawnSync(process.execPath, [script, 'resolve'], { env: { ...environment, REQUESTED_TARGET: 'missing' }, encoding: 'utf8' });
  expect(invalid.status).toBe(1);
  expect(readFileSync(output, 'utf8')).toBe(`sha=${first}\n`);
});
