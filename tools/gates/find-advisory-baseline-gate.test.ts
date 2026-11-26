import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from './run-gate';

const COMMAND = path.join(REPO_ROOT, 'tools', 'find-advisory-baseline.ts');

const sandbox = mkdtempSync(path.join(realpathSync(tmpdir()), 'find-baseline-'));

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const FAKE_GH = `#!${process.execPath}
const { appendFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const scenario = JSON.parse(process.env.FAKE_GH);
appendFileSync(process.env.FAKE_GH_LOG, args.join(' ') + '\\n');
if (args[0] === 'run' && args[1] === 'list') {
  if (scenario.list.error) { console.error(scenario.list.error); process.exit(1); }
  console.log(JSON.stringify(scenario.list.rows));
} else if (args[0] === 'run' && args[1] === 'download') {
  const run = args[2];
  const outcome = scenario.download[run];
  if (outcome === undefined || outcome.error) { console.error(outcome ? outcome.error : 'no artifact'); process.exit(1); }
  const directory = args[args.indexOf('--dir') + 1];
  mkdirSync(path.join(directory, 'test-results', 'advisory-feature'), { recursive: true });
  writeFileSync(path.join(directory, 'test-results', 'advisory-feature', 'report.json'), outcome.report);
}
`;

let scenarios = 0;

type Scenario = {
  readonly list: { readonly rows?: readonly object[]; readonly error?: string };
  readonly download?: Record<string, { readonly report?: string; readonly error?: string }>;
};

const lookup = (scenario: Scenario) => {
  scenarios += 1;
  const home = path.join(sandbox, `scenario-${String(scenarios)}`);
  const bin = path.join(home, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'gh'), FAKE_GH);
  chmodSync(path.join(bin, 'gh'), 0o755);
  const log = path.join(home, 'gh.log');
  const summary = path.join(home, 'summary.md');
  const directory = path.join(home, 'baseline');
  const result = spawnSync(process.execPath, [COMMAND, 'milestone/x', directory], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`,
      FAKE_GH: JSON.stringify({ download: {}, ...scenario }),
      FAKE_GH_LOG: log,
      GITHUB_STEP_SUMMARY: summary,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    summary: existsSync(summary) ? readFileSync(summary, 'utf8') : '',
    report: existsSync(path.join(directory, 'report.json')) ? readFileSync(path.join(directory, 'report.json'), 'utf8') : undefined,
    calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [],
  };
};

describe('find-advisory-baseline.ts', () => {
  it('takes the report of the latest completed push run and names the run and its commit', () => {
    const found = lookup({
      list: { rows: [{ databaseId: 42, headSha: 'abc123' }] },
      download: { '42': { report: '{"suites":[]}' } },
    });

    expect(found.status).toBe(0);
    expect(found.report).toBe('{"suites":[]}');
    expect(found.summary).toContain('Baseline: the JSON report of run 42 at abc123, the latest completed push run on milestone/x.');
    expect(found.calls[0]).toContain('--branch milestone/x --event push --status completed --limit 1');
  });

  it('reports no baseline, naming the run, when the latest run kept no artifact, and never reaches for an older run', () => {
    const found = lookup({
      list: { rows: [{ databaseId: 42, headSha: 'abc123' }, { databaseId: 41, headSha: 'older' }] },
      download: { '42': { error: 'no valid artifacts found' }, '41': { report: '{"suites":[]}' } },
    });

    expect(found.status).toBe(0);
    expect(found.report).toBeUndefined();
    expect(found.summary).toContain('No baseline:');
    expect(found.summary).toContain('run 42 at abc123');
    expect(found.summary).toContain('no valid artifacts found');
    expect(found.calls.filter((call) => call.startsWith('run download'))).toHaveLength(1);
  });

  it('reports no baseline when the base branch has no completed push run', () => {
    const found = lookup({ list: { rows: [] } });

    expect(found.status).toBe(0);
    expect(found.report).toBeUndefined();
    expect(found.summary).toContain('No baseline: milestone/x has no completed push run.');
  });

  it('gives a failed listing as the reason and still succeeds', () => {
    const found = lookup({ list: { error: 'HTTP 403: Resource not accessible by integration' } });

    expect(found.status).toBe(0);
    expect(found.report).toBeUndefined();
    expect(found.summary).toContain('No baseline: listing the completed push runs on milestone/x failed: HTTP 403');
  });

  it('gives a failed download as the reason and still succeeds', () => {
    const found = lookup({
      list: { rows: [{ databaseId: 7, headSha: 'def456' }] },
      download: { '7': { error: 'HTTP 401: Bad credentials' } },
    });

    expect(found.status).toBe(0);
    expect(found.summary).toContain('HTTP 401: Bad credentials');
    expect(found.summary).toContain('run 7 at def456');
  });
});
