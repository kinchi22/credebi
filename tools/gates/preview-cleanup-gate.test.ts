import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { REPO_ROOT } from './run-gate';
import { expect, it } from 'vitest';
import { captureSnapshot, cleanSnapshot, verifySnapshot, executeSnapshot, type Snapshot, type Deployment } from '../preview-cleanup';

const PROJECT = 'credebi-project';
const TEAM = 'credebi-team';
const deployment = (id: string, target: string | null, created = 10, projectId = PROJECT): Deployment =>
  ({ id, target, created, projectId });

it('captures every page once and freezes only existing Previews in the intended project', async () => {
  const pages = new Map([
    [100, { deployments: [deployment('latest', null, 90), deployment('current', 'production', 80)], next: 70 }],
    [70, { deployments: [deployment('old', null, 60), deployment('rollback', 'production', 50), deployment('other', null, 40, 'other-project'), deployment('later', null, 110)], next: null }],
  ]);
  const snapshot = await captureSnapshot(PROJECT, TEAM, 100, (until) => {
    const page = pages.get(until);
    if (!page) throw new Error('Unexpected cursor');
    return Promise.resolve(page);
  });
  expect(snapshot).toEqual({ projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 2, previewIds: ['latest', 'old'], productionIds: ['current', 'rollback'] });
});

it('removes the frozen list and preserves Production, other projects and later Previews', async () => {
  const current = new Map([
    deployment('latest', null), deployment('old', null), deployment('current', 'production'),
    deployment('rollback', 'production'), deployment('other', null, 10, 'other-project'),
    deployment('later', null, 110),
  ].map((row) => [row.id, row]));
  const result = await cleanSnapshot(
    { projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 2, previewIds: ['latest', 'old'], productionIds: ['current', 'rollback'] },
    (id) => Promise.resolve(current.get(id)),
    (id) => { current.delete(id); return Promise.resolve(); },
  );
  expect(result).toEqual({ removed: ['latest', 'old'], failures: [], missingProduction: [] });
  expect([...current.keys()]).toEqual(['current', 'rollback', 'other', 'later']);
});

it('reports every deletion failure and refuses captured deployments outside the scope', async () => {
  const current = new Map([
    deployment('blocked', null), deployment('remains', null), deployment('production', 'production'),
    deployment('other', null, 10, 'other-project'), deployment('later', null, 110),
  ].map((row) => [row.id, row]));
  const result = await cleanSnapshot(
    { projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 1, previewIds: [...current.keys()], productionIds: ['production'] },
    (id) => Promise.resolve(current.get(id)),
    (id) => id === 'blocked' ? Promise.reject(new Error('Forbidden')) : Promise.resolve(),
  );
  expect(result).toEqual({
    removed: [],
    failures: [
      { id: 'blocked', reason: 'Forbidden' },
      { id: 'remains', reason: 'Captured Preview remains after deletion' },
      { id: 'production', reason: 'Captured deployment is outside the Preview cleanup scope' },
      { id: 'other', reason: 'Captured deployment is outside the Preview cleanup scope' },
      { id: 'later', reason: 'Captured deployment is outside the Preview cleanup scope' },
    ],
    missingProduction: [],
  });
  expect([...current.keys()]).toEqual(['blocked', 'remains', 'production', 'other', 'later']);
});

it('aborts incomplete inventory when pagination repeats', async () => {
  await expect(captureSnapshot(PROJECT, TEAM, 100, () => Promise.resolve({ deployments: [], next: 100 }))).rejects.toThrow('Inventory pagination did not advance');
});

it('propagates inventory failures instead of producing a partial deletion list', async () => {
  await expect(captureSnapshot(PROJECT, TEAM, 100, () => Promise.reject(new Error('Inventory unavailable')))).rejects.toThrow('Inventory unavailable');
});

it('rejects truncated inventory instead of silently leaving an unlisted Preview behind', async () => {
  await expect(captureSnapshot(PROJECT, TEAM, 100, () => Promise.resolve({ deployments: [deployment('...[truncated]', null)], next: null }))).rejects.toThrow('Inventory contains a truncated deployment');
});

it('verifies the captured baseline and rejects a cleanup with remaining Previews', () => {
  const snapshot = { projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 1, previewIds: ['old'], productionIds: ['current', 'rollback'] };
  expect(verifySnapshot(snapshot, [deployment('old', null), deployment('current', 'production'), deployment('later', null, 110)])).toEqual({ remainingPreviewIds: ['old'], missingProductionIds: ['rollback'] });
  expect(verifySnapshot(snapshot, [deployment('current', 'production'), deployment('rollback', 'production'), deployment('later', null, 110)])).toEqual({ remainingPreviewIds: [], missingProductionIds: [] });
});

it('refuses any deletion when the Production baseline cannot be confirmed before cleanup', async () => {
  const current = new Map([deployment('old', null)].map((row) => [row.id, row]));
  const result = await cleanSnapshot(
    { projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 1, previewIds: ['old'], productionIds: ['missing'] },
    (id) => Promise.resolve(current.get(id)),
    (id) => { current.delete(id); return Promise.resolve(); },
  );
  expect(result).toEqual({ removed: [], failures: [], missingProduction: ['missing'] });
  expect([...current.keys()]).toEqual(['old']);
});

it('executes against the fixed manifest and independently verifies the resulting paginated inventory', async () => {
  const current = new Map([deployment('old', null), deployment('current', 'production'), deployment('later', null, 110)].map((row) => [row.id, row]));
  const result = await executeSnapshot(
    { projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 1, previewIds: ['old'], productionIds: ['current'] },
    (endpoint, method) => {
      if (method === 'DELETE') {
        const id = endpoint.split('/').at(-1)?.split('?')[0] ?? '';
        current.delete(id);
        return Promise.resolve({ state: 'DELETED', uid: id });
      }
      const url = new URL(endpoint, 'https://example.invalid');
      expect(url.searchParams.get('projectId')).toBe(PROJECT);
      expect(url.searchParams.get('teamId')).toBe(TEAM);
      return Promise.resolve({ deployments: [...current.values()].map((row) => ({ uid: row.id, target: row.target, created: row.created })), pagination: { next: null } });
    },
  );
  expect(result).toEqual({ removed: ['old'], failures: [], missingProduction: [], remainingPreviewIds: [], missingProductionIds: [] });
  expect([...current.keys()]).toEqual(['current', 'later']);
});

it('reports a Preview still present in independent inventory even when deletion responds successfully', async () => {
  const old = deployment('old', null);
  const result = await executeSnapshot(
    { projectId: PROJECT, teamId: TEAM, capturedAt: 100, pages: 1, previewIds: ['old'], productionIds: [] },
    (_endpoint, method) => Promise.resolve(method === 'DELETE' ? { state: 'DELETED', uid: 'old' } : { deployments: [{ uid: old.id, target: old.target, created: old.created }], pagination: { next: null } }),
  );
  expect(result.remainingPreviewIds).toEqual(['old']);
});

it('refuses an executable cleanup whose manifest differs from the frozen list', () => {
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools/preview-cleanup.ts'), '/dev/null'], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('The manifest does not match the frozen cleanup snapshot');
});

it('runs the CLI with a frozen manifest and preserves later Previews and every Production deployment', () => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'preview-cleanup-'));
  try {
    const snapshot = JSON.parse(readFileSync(path.join(REPO_ROOT, 'tools/preview-cleanup-snapshot.json'), 'utf8')) as Snapshot;
    const state = path.join(sandbox, 'state.json');
    const report = path.join(sandbox, 'report.json');
    writeFileSync(state, JSON.stringify([
      { uid: snapshot.previewIds[0], target: null, created: 10 },
      ...snapshot.productionIds.map((uid) => ({ uid, target: 'production', created: 10 })),
      { uid: 'dpl_later', target: null, created: snapshot.capturedAt + 1 },
    ]));
    const executable = path.join(sandbox, 'vercel');
    writeFileSync(executable, [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      'const args = process.argv.slice(2);',
      'const state = process.env.CLEANUP_STATE;',
      'const snapshot = JSON.parse(fs.readFileSync(process.env.CLEANUP_SNAPSHOT));',
      "if (args[0] === 'project') { console.log(JSON.stringify({id: snapshot.projectId, accountId: snapshot.teamId})); }",
      "else if (args[0] === 'api') { console.log(JSON.stringify({deployments: JSON.parse(fs.readFileSync(state)), pagination: {next: null}})); }",
      "else if (args[0] === 'remove') { fs.writeFileSync(state, JSON.stringify(JSON.parse(fs.readFileSync(state)).filter(row => row.uid !== args[1]))); }",
      'else { process.exit(1); }',
    ].join('\n'));
    chmodSync(executable, 0o755);
    const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools/preview-cleanup.ts'), path.join(REPO_ROOT, 'tools/preview-cleanup-snapshot.json'), report], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${sandbox}${path.delimiter}${process.env['PATH'] ?? ''}`, CLEANUP_STATE: state, CLEANUP_SNAPSHOT: path.join(REPO_ROOT, 'tools/preview-cleanup-snapshot.json') },
    });
    expect(result.status, result.stderr).toBe(0);
    const outcome = JSON.parse(readFileSync(report, 'utf8')) as { removed: string[]; failures: unknown[]; remainingPreviewIds: string[]; missingProductionIds: string[] };
    expect(outcome.removed).toEqual(snapshot.previewIds);
    expect(outcome.failures).toEqual([]);
    expect(outcome.remainingPreviewIds).toEqual([]);
    expect(outcome.missingProductionIds).toEqual([]);
    const preserved = JSON.parse(readFileSync(state, 'utf8')) as { uid: string }[];
    expect(preserved.map((row) => row.uid)).toEqual([...snapshot.productionIds, 'dpl_later']);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
