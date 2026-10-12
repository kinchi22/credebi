import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
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

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

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

it('keeps approval and the token after resolution, uses the frozen checkout, and remains manual', () => {
  const workflow = readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/manual-preview.yml'), 'utf8');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).not.toMatch(/^ {2}(push|pull_request|workflow_call|schedule):/m);
  expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  const resolve = workflow.slice(workflow.indexOf('  resolve:'), workflow.indexOf('  deploy:'));
  expect(resolve).not.toContain('VERCEL_TOKEN');
  const deploy = workflow.slice(workflow.indexOf('  deploy:'), workflow.indexOf('  summary:'));
  expect(deploy).toContain('needs: resolve');
  expect(deploy).toContain('name: preview-deployment');
  expect(deploy).toContain('name: Deploy approved ${{ needs.resolve.outputs.sha }} to Preview');
  expect(deploy).toContain('ref: ${{ needs.resolve.outputs.sha }}');
  expect(deploy).toContain('path: source');
  expect(deploy).toContain('APPROVED_SHA: ${{ needs.resolve.outputs.sha }}');
  expect(deploy).toContain('VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}');
  expect(deploy).toContain('node tooling/tools/manual-preview.ts deploy');
  expect(workflow).toContain('if: always()');
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
