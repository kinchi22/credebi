import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkSelfReport,
  coalesceProductionReleases,
  crossCheckIdentity,
  decideCompatibility,
  decideProductionRelease,
  readDeploymentIdentity,
  selectReleaseCommit,
  type DeploymentIdentity,
} from '../production-release';
import { REPO_ROOT } from './run-gate';

const SUCCESSFUL_PREREQUISITES = [
  { name: 'Gates', outcome: 'success' },
  { name: 'Integration', outcome: 'success' },
] as const;

describe('decideProductionRelease', () => {
  it.each([
    ['Gates', [{ name: 'Integration', outcome: 'success' }]],
    ['Integration', [{ name: 'Gates', outcome: 'success' }]],
  ] as const)('fails closed when the %s result is missing', (name, prerequisites) => {
    expect(
      decideProductionRelease({
        prerequisites,
        migration: { state: 'none', outcome: 'skipped-no-migration' },
      }),
    ).toEqual({
      decision: 'fail',
      reason: `${name} result is missing; Production is not ready.`,
    });
  });

  it('fails closed when a required prerequisite result is duplicated', () => {
    expect(
      decideProductionRelease({
        prerequisites: [
          { name: 'Gates', outcome: 'success' },
          { name: 'Gates', outcome: 'failure' },
          { name: 'Integration', outcome: 'success' },
        ],
        migration: { state: 'none', outcome: 'skipped-no-migration' },
      }),
    ).toEqual({
      decision: 'fail',
      reason: 'Gates result is duplicated; Production is not ready.',
    });
  });

  it.each(['missing-applied-commit', 'uncomparable-applied-commit'] as const)(
    'requests approval when migration state is unknown because it is %s',
    (reason) => {
      expect(
        decideProductionRelease({
          prerequisites: SUCCESSFUL_PREREQUISITES,
          migration: { state: 'unknown', reason, outcome: 'not-started' },
        }),
      ).toEqual({
        decision: 'request-approval',
        reason: `Migration state is unknown (${reason}); Production approval is required.`,
      });
    },
  );

  it.each(['failure', 'cancelled', 'skipped'] as const)(
    'fails when a prerequisite is %s',
    (outcome) => {
      expect(
        decideProductionRelease({
          prerequisites: [
            { name: 'Gates', outcome: 'success' },
            { name: 'Integration', outcome },
          ],
          migration: { state: 'none', outcome: 'skipped-no-migration' },
        }),
      ).toEqual({
        decision: 'fail',
        reason: `Integration was ${outcome}; Production is not ready.`,
      });
    },
  );

  it.each([
    [
      'production-ready',
      { state: 'none', outcome: 'skipped-no-migration' },
      'No migration is pending; the intentional migration skip is valid.',
    ],
    [
      'fail',
      { state: 'none', outcome: 'skipped' },
      'The migration prerequisite was skipped without a no-migration decision.',
    ],
    [
      'request-approval',
      { state: 'pending', outcome: 'not-started' },
      'A Production migration is pending and requires approval.',
    ],
    [
      'wait',
      { state: 'pending', outcome: 'running' },
      'The Production migration is running and must not be cancelled.',
    ],
    [
      'record-migration-success',
      { state: 'pending', outcome: 'success' },
      'The Production migration succeeded; record its commit before downstream checks.',
    ],
    [
      'production-ready',
      { state: 'none', outcome: 'success' },
      'Migration success is already recorded and every prerequisite succeeded.',
    ],
    [
      'fail',
      { state: 'pending', outcome: 'failure' },
      'The Production migration was failure; Production is not ready.',
    ],
    [
      'fail',
      { state: 'pending', outcome: 'cancelled' },
      'The Production migration was cancelled; Production is not ready.',
    ],
  ] as const)(
    'returns %s for a migration outcome',
    (decision, migration, reason) => {
      expect(
        decideProductionRelease({
          prerequisites: SUCCESSFUL_PREREQUISITES,
          migration,
        }),
      ).toEqual({ decision, reason });
    },
  );
});

describe('coalesceProductionReleases', () => {
  it('keeps a running migration and coalesces waiting releases to the newest commit', () => {
    expect(
      coalesceProductionReleases({
        runningCommit: 'running',
        waitingCommits: ['older', 'newest'],
      }),
    ).toEqual({
      runningCommit: 'running',
      cancelRunning: false,
      waitingCommit: 'newest',
      waitingDecision: 'recalculate-after-running',
    });
  });

  it('recalculates pending migrations for the newest commit when no migration is running', () => {
    expect(
      coalesceProductionReleases({
        runningCommit: null,
        waitingCommits: ['older', 'newest'],
      }),
    ).toEqual({
      runningCommit: null,
      cancelRunning: false,
      waitingCommit: 'newest',
      waitingDecision: 'recalculate-now',
    });
  });
});

describe('selectReleaseCommit', () => {
  it('releases only the newest main commit after a queued run starts', () => {
    expect(selectReleaseCommit('older', 'newest')).toEqual({ current: false });
    expect(selectReleaseCommit('newest', 'newest')).toEqual({ current: true });
  });

  it('fails closed when the main ref cannot be read', () => {
    expect(selectReleaseCommit('newest', undefined)).toEqual({ current: false });
  });
});

const RELEASE_COMMIT = 'a'.repeat(40);

const CURRENT_PRODUCTION: DeploymentIdentity = {
  id: 'dpl_previous',
  commit: 'd'.repeat(40),
  url: 'https://credebi-previous.vercel.app',
};

const REDEPLOYED: DeploymentIdentity = {
  id: 'dpl_rolled_back',
  commit: 'e'.repeat(40),
  url: 'https://credebi-rolled-back.vercel.app',
};

const healthBody = (deployment: unknown) => ({
  result: {
    data: {
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: '2026-10-24T00:00:00.000Z',
      deployment,
    },
  },
});

const reported = (deployment: DeploymentIdentity) =>
  readDeploymentIdentity(deployment.url, healthBody(deployment));

describe('readDeploymentIdentity', () => {
  it('reads the identity a deployment reports about itself', () => {
    expect(reported(CURRENT_PRODUCTION)).toEqual({ ok: true, identity: CURRENT_PRODUCTION });
  });

  it.each([
    ['no deployment field', undefined, 'reports no deployment identity'],
    ['every field null', { id: null, commit: null, url: null }, 'reports no deployment id'],
    ['an empty id', { ...CURRENT_PRODUCTION, id: '' }, 'reports no deployment id'],
    ['a null commit', { ...CURRENT_PRODUCTION, commit: null }, 'reports no full commit SHA'],
    ['a short commit', { ...CURRENT_PRODUCTION, commit: 'd48b5f0' }, 'reports no full commit SHA'],
    ['a null URL', { ...CURRENT_PRODUCTION, url: null }, 'reports no HTTPS fixed URL'],
    ['a bare host', { ...CURRENT_PRODUCTION, url: 'credebi-previous.vercel.app' }, 'reports no HTTPS fixed URL'],
    ['a plain HTTP URL', { ...CURRENT_PRODUCTION, url: 'http://credebi-previous.vercel.app' }, 'reports no HTTPS fixed URL'],
    ['a URL with a path', { ...CURRENT_PRODUCTION, url: 'https://credebi-previous.vercel.app/x' }, 'reports no HTTPS fixed URL'],
  ])('blocks readiness on %s', (_, deployment, reason) => {
    expect(readDeploymentIdentity('https://credebi.example', healthBody(deployment))).toEqual({
      ok: false,
      reason: `https://credebi.example ${reason}.`,
    });
  });

  it('blocks readiness on a body that is not a health answer at all', () => {
    expect(readDeploymentIdentity('https://credebi.example', '<html>Vercel login</html>').ok).toBe(false);
  });
});

describe('crossCheckIdentity', () => {
  it('binds the compatibility run to Current Production, never to the release commit', () => {
    const target = crossCheckIdentity(reported(CURRENT_PRODUCTION), reported(CURRENT_PRODUCTION));

    expect(target).toEqual({ ok: true, identity: CURRENT_PRODUCTION });
    expect(target.ok && target.identity.commit).not.toBe(RELEASE_COMMIT);
  });

  it('blocks readiness when the fixed URL names another deployment than the domain did', () => {
    const result = crossCheckIdentity(reported(CURRENT_PRODUCTION), reported(REDEPLOYED));

    expect(result).toEqual({
      ok: false,
      reason:
        `${CURRENT_PRODUCTION.url} reports deployment ${REDEPLOYED.id} at ${REDEPLOYED.commit}, ` +
        `not the ${CURRENT_PRODUCTION.id} at ${CURRENT_PRODUCTION.commit} the production domain named.`,
    });
  });

  it.each([
    ['the domain', { ok: false, reason: 'domain unknown' }, reported(CURRENT_PRODUCTION)],
    ['the fixed URL', reported(CURRENT_PRODUCTION), { ok: false, reason: 'fixed URL unknown' }],
  ] as const)('passes on the failure when %s cannot be identified', (_, domain, fixed) => {
    const result = crossCheckIdentity(domain, fixed);
    expect(result.ok).toBe(false);
    expect(result).toEqual(domain.ok ? fixed : domain);
  });
});

describe('checkSelfReport', () => {
  it('accepts a deployment that reports the commit its event carried', () => {
    expect(checkSelfReport(reported(CURRENT_PRODUCTION), CURRENT_PRODUCTION.commit)).toEqual({
      ok: true,
      identity: CURRENT_PRODUCTION,
    });
  });

  it('rejects a deployment that reports another commit', () => {
    expect(checkSelfReport(reported(CURRENT_PRODUCTION), RELEASE_COMMIT)).toEqual({
      ok: false,
      reason: `${CURRENT_PRODUCTION.url} reports commit ${CURRENT_PRODUCTION.commit}, not ${RELEASE_COMMIT}.`,
    });
  });

  it('rejects a deployment that reports no identity', () => {
    expect(checkSelfReport({ ok: false, reason: 'no identity' }, RELEASE_COMMIT)).toEqual({
      ok: false,
      reason: 'no identity',
    });
  });
});

describe('decideCompatibility', () => {
  it('passes when Current Production passed its own specs and stayed the same deployment', () => {
    expect(
      decideCompatibility({ attempt: 1, target: CURRENT_PRODUCTION, smoke: 'success', after: CURRENT_PRODUCTION }),
    ).toEqual({
      decision: 'pass',
      reason: `Current Production passed its own smoke specs at ${CURRENT_PRODUCTION.commit} on the resulting schema.`,
    });
  });

  it('blocks Promotion when Current Production fails its own specs on the migrated schema', () => {
    expect(
      decideCompatibility({ attempt: 1, target: CURRENT_PRODUCTION, smoke: 'failure', after: CURRENT_PRODUCTION }),
    ).toEqual({
      decision: 'fail',
      reason: `Current Production failed its own smoke specs at ${CURRENT_PRODUCTION.commit} on the resulting schema.`,
    });
  });

  it.each(['success', 'failure'] as const)(
    'reruns once against the new deployment when Current Production changed during a %s',
    (smoke) => {
      const decision = decideCompatibility({ attempt: 1, target: CURRENT_PRODUCTION, smoke, after: REDEPLOYED });
      expect(decision.decision).toBe('rerun');
      expect(decision.reason).toContain(`to ${REDEPLOYED.id} at ${REDEPLOYED.commit}`);
    },
  );

  it('fails when Current Production changed again during the rerun', () => {
    expect(
      decideCompatibility({ attempt: 2, target: REDEPLOYED, smoke: 'success', after: CURRENT_PRODUCTION }).decision,
    ).toBe('fail');
  });

  it.each([
    ['its id', { ...CURRENT_PRODUCTION, id: 'dpl_other' }],
    ['its commit', { ...CURRENT_PRODUCTION, commit: 'f'.repeat(40) }],
    ['its URL', { ...CURRENT_PRODUCTION, url: 'https://credebi-other.vercel.app' }],
  ])('treats a change in %s alone as a different deployment', (_, after) => {
    expect(
      decideCompatibility({ attempt: 1, target: CURRENT_PRODUCTION, smoke: 'success', after }).decision,
    ).toBe('rerun');
  });

  it('fails when Current Production cannot be identified after the run', () => {
    expect(
      decideCompatibility({ attempt: 1, target: CURRENT_PRODUCTION, smoke: 'success', after: null }).decision,
    ).toBe('fail');
  });
});

describe('Production release workflow invariants', () => {
  const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
  const release = readFileSync(
    path.join(REPO_ROOT, '.github/workflows/production-release.yml'),
    'utf8',
  );

  it('keeps a running migration and the newest waiting run without canceling validation', () => {
    expect(ci).not.toMatch(/^concurrency:/m);
    expect(ci).toMatch(/group: production-release\n\s+queue: max/);
    expect(ci).toMatch(/release:\n[\s\S]*?needs: \[gates, integration\]/);
    expect(release).toContain("needs.select.outputs.current == 'true'");
  });

  it('orders the database work and publishes readiness for every main push', () => {
    expect(release).toMatch(/preview:[\s\S]*?pending:[\s\S]*?needs: preview/);
    expect(release).toMatch(/migrate:[\s\S]*?needs: pending/);
    expect(release).toContain('exit 1');
    expect(ci).toMatch(/production-ready:\n\s+name: Production ready\n\s+if: always\(\)/);
    expect(ci).toContain('needs: [gates, integration, release]');
  });

  it('rechecks the main commit after pending detection before requesting approval', () => {
    const pending = release.slice(release.indexOf('\n  pending:'), release.indexOf('\n  migrate:'));
    const migrate = release.slice(release.indexOf('\n  migrate:'), release.indexOf('\n  result:'));

    expect(pending.indexOf('node tools/find-pending-migrations.ts')).toBeLessThan(
      pending.lastIndexOf('node tools/production-release.ts current'),
    );
    expect(migrate).toContain("needs.pending.outputs.current == 'true'");
    expect(release).toContain('CURRENT_AFTER_PENDING: ${{ needs.pending.outputs.current }}');
  });

  it('smokes Current Production after migration and requires it for readiness', () => {
    const compatibility = release.slice(release.indexOf('\n  compatibility:'));

    expect(compatibility).toMatch(/compatibility:\n\s+name: Smoke Current Production after migration\n\s+if: >-\n\s+always\(\) &&/);
    expect(compatibility).toContain("needs.result.outputs.migration_state == 'none'");
    expect(compatibility).toContain("needs.result.outputs.migration_outcome == 'success'");
    expect(compatibility).toContain("needs.result.outputs.migration_outcome == 'skipped-no-migration'");
    expect(compatibility).toContain('needs: result');
    expect(compatibility).toContain('PRODUCTION_URL: ${{ vars.PRODUCTION_URL }}');
    expect(compatibility).toContain('pnpm test:e2e --grep @smoke');
    expect(ci).toContain('COMPATIBILITY_RESULT: ${{ needs.release.outputs.compatibility_result }}');
    expect(ci).toContain('test "$COMPATIBILITY_RESULT" = success');
  });

  it('runs the specs of the commit Current Production reports, from a worktree, against its fixed URL', () => {
    const compatibility = release.slice(release.indexOf('\n  compatibility:'));
    const steps = [
      'target=$(node "$release" identify "$domain")',
      'commit=$(jq -r .commit <<<"$target")',
      'git worktree add --detach "$tree" "$commit"',
      'cd "$tree"',
      'E2E_BASE_URL="$url" pnpm test:e2e --grep @smoke',
      'after=$(node "$release" identify "$domain" || echo null)',
      'node "$release" compatibility "$input"',
    ];

    const positions = steps.map((step) => compatibility.indexOf(step));
    expect(positions.every((position) => position >= 0), steps.join('\n')).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(compatibility).not.toContain('E2E_BASE_URL: ${{ vars.PRODUCTION_URL }}');
    expect(compatibility).toMatch(/pass\) exit 0 ;;\n\s+rerun\) attempt=\$\(\(attempt \+ 1\)\) ;;\n\s+\*\) exit 1 ;;/);
  });

  it('checks the exact ready-event SHA and publishes candidate status', () => {
    const candidate = readFileSync(
      path.join(REPO_ROOT, '.github/workflows/candidate-production-smoke.yml'), 'utf8',
    );
    expect(candidate).toContain('vercel.deployment.ready');
    expect(candidate).toContain("github.event.client_payload.environment == 'production'");
    expect(candidate).toContain("github.event.client_payload.environment == ''");
    expect(candidate).toContain('permissions:');
    expect(candidate).toContain('actions: read');
    expect(candidate).toContain('statuses: write');
    expect(candidate).toContain('ref: ${{ steps.pending.outputs.sha }}');
    expect(candidate).toContain('E2E_BASE_URL: ${{ steps.pending.outputs.url }}');
    expect(candidate).toContain('pnpm test:e2e --grep @smoke');
  });

  it('checks the candidate reports the event SHA before smoking it, with the tool saved from main', () => {
    const candidate = readFileSync(
      path.join(REPO_ROOT, '.github/workflows/candidate-production-smoke.yml'), 'utf8',
    );
    const check = candidate.indexOf('node "$RUNNER_TEMP/production-release.ts" verify "$input"');

    expect(candidate).toContain('cp tools/production-release.ts "$RUNNER_TEMP/production-release.ts"');
    expect(candidate).toContain('CANDIDATE_SHA: ${{ steps.pending.outputs.sha }}');
    expect(candidate).toContain('CANDIDATE_URL: ${{ steps.pending.outputs.url }}');
    expect(check).toBeGreaterThan(candidate.indexOf('id: readiness'));
    expect(check).toBeLessThan(candidate.indexOf('id: candidate'));
  });
});

describe('Post-Promotion smoke workflow', () => {
  const workflows = path.join(REPO_ROOT, '.github/workflows');
  const promoted = readFileSync(path.join(workflows, 'promoted-production-smoke.yml'), 'utf8');

  const checkEvent = (env: Record<string, string>) => {
    const script = /- name: Check the promoted event\n[\s\S]*?run: \|\n([\s\S]*?)\n\s+- uses:/.exec(promoted)?.[1];
    if (script === undefined) throw new Error('The promoted-event check step is missing.');
    const sandbox = mkdtempSync(path.join(tmpdir(), 'promoted-smoke-'));
    const output = path.join(sandbox, 'output');
    try {
      const result = spawnSync('bash', ['-e', '-c', script.replace(/^ {10}/gm, '')], {
        encoding: 'utf8',
        env: { PATH: process.env['PATH'] ?? '', GITHUB_OUTPUT: output, ...env },
      });
      return { result, written: existsSync(output) ? readFileSync(output, 'utf8') : '' };
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  };

  it('starts on the promoted event, and no workflow listens to deployment_status', () => {
    const listeners = readdirSync(workflows).filter((file) =>
      /^\s+deployment_status:/m.test(readFileSync(path.join(workflows, file), 'utf8')),
    );
    expect(listeners).toEqual([]);
    expect(promoted).toMatch(/repository_dispatch:\n\s+types: \[vercel\.deployment\.promoted\]/);
  });

  it('smokes the production domain at the exact promoted SHA without writing anything', () => {
    expect(promoted).toMatch(/permissions:\n\s+contents: read\n\n/);
    expect(promoted).toContain('ref: ${{ steps.promoted.outputs.sha }}');
    expect(promoted).toContain('E2E_BASE_URL: ${{ vars.PRODUCTION_URL }}');
    expect(promoted).toContain('VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}');
    expect(promoted).toContain('SMOKE_SESSION_TOKEN: ${{ secrets.SMOKE_SESSION_TOKEN }}');
    expect(promoted).toContain('pnpm test:e2e --grep @smoke');
    expect(promoted).not.toMatch(/upload-artifact|vercel (rollback|promote)|statuses: write/);
  });

  it('checks the production domain reports the promoted SHA before smoking it', () => {
    const check = promoted.indexOf('node tools/production-release.ts verify "$input"');

    expect(promoted).toContain('PROMOTED_SHA: ${{ steps.promoted.outputs.sha }}');
    expect(check).toBeGreaterThan(promoted.indexOf('id: promoted'));
    expect(check).toBeLessThan(promoted.indexOf('ref: ${{ steps.promoted.outputs.sha }}'));
  });

  it('runs the job for a production or environment-less event only, so a preview never starts it', () => {
    const condition = /\n {4}if: >-\n((?: {6}.*\n)+)/.exec(promoted)?.[1]?.replace(/\s+/g, ' ').trim();
    expect(condition).toBe(
      "github.event.client_payload.environment == 'production' || " +
        "github.event.client_payload.environment == ''",
    );
  });

  it('passes the promoted SHA on to checkout', () => {
    const sha = 'b'.repeat(40);
    const { result, written } = checkEvent({ PROMOTED_ENVIRONMENT: 'production', PROMOTED_SHA: sha });
    expect(result.status, result.stderr).toBe(0);
    expect(written).toBe(`sha=${sha}\n`);
  });

  it.each([
    ['a missing SHA', { PROMOTED_ENVIRONMENT: 'production', PROMOTED_SHA: '' }],
    ['a short SHA', { PROMOTED_ENVIRONMENT: 'production', PROMOTED_SHA: 'abc1234' }],
    ['a missing environment', { PROMOTED_ENVIRONMENT: '', PROMOTED_SHA: 'c'.repeat(40) }],
  ])('fails on %s rather than smoking the default branch', (_, env) => {
    const { result, written } = checkEvent(env);
    expect(result.status).not.toBe(0);
    expect(written).toBe('');
  });
});

describe('production-release.ts, run as CI runs it', () => {
  const runCommand = (command: string, input: unknown) =>
    spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'production-release.ts'), command, JSON.stringify(input)],
      { encoding: 'utf8' },
    );

  it('exposes release decisions as JSON', () => {
    const result = runCommand('decide', {
      prerequisites: SUCCESSFUL_PREREQUISITES,
      migration: { state: 'none', outcome: 'skipped-no-migration' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      decision: 'production-ready',
      reason: 'No migration is pending; the intentional migration skip is valid.',
    });
  });

  it('exposes queue decisions as JSON', () => {
    const result = runCommand('queue', {
      runningCommit: 'running',
      waitingCommits: ['old', 'new'],
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      runningCommit: 'running',
      cancelRunning: false,
      waitingCommit: 'new',
      waitingDecision: 'recalculate-after-running',
    });
  });

  it('exposes the current-main decision for a queued release', () => {
    const result = runCommand('current', { commit: 'older', mainHead: 'newest' });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ current: false });
  });

  it('writes scalar release outputs for a workflow step', () => {
    const sandbox = mkdtempSync(path.join(tmpdir(), 'production-release-'));
    const output = path.join(sandbox, 'output');
    try {
      const result = spawnSync(
        process.execPath,
        [
          path.join(REPO_ROOT, 'tools', 'production-release.ts'),
          'decide',
          JSON.stringify({
            prerequisites: SUCCESSFUL_PREREQUISITES,
            migration: { state: 'pending', outcome: 'running' },
          }),
        ],
        { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, 'utf8')).toBe(
        [
          'decision=wait',
          'reason=The Production migration is running and must not be cancelled.',
          '',
        ].join('\n'),
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('fails closed when a required prerequisite result is absent', () => {
    const result = runCommand('decide', {
      prerequisites: [{ name: 'Gates', outcome: 'success' }],
      migration: { state: 'none', outcome: 'skipped-no-migration' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      decision: 'fail',
      reason: 'Integration result is missing; Production is not ready.',
    });
  });

  it('fails closed when the command or input is missing', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'production-release.ts'), 'decide'],
      { encoding: 'utf8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Production release input must be a JSON argument.');
  });
});

describe('production-release.ts, asking a deployment who it is', () => {
  const run = promisify(execFile);
  const BYPASS = 'bypass-secret';
  let server: Server | undefined;

  afterEach(async () => {
    const running = server;
    server = undefined;
    if (running !== undefined) {
      await new Promise((resolve) => {
        running.close(resolve);
      });
    }
  });

  const serve = async (answer: (host: string) => unknown): Promise<string> => {
    server = createServer((request, response) => {
      if (request.headers['x-vercel-protection-bypass'] !== BYPASS || request.url !== '/api/trpc/health.get') {
        response.writeHead(401).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(healthBody(answer(request.headers.host ?? ''))));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  };

  const command = async (name: string, input: unknown, bypass = BYPASS) => {
    try {
      const { stdout } = await run(
        process.execPath,
        [path.join(REPO_ROOT, 'tools', 'production-release.ts'), name, JSON.stringify(input)],
        { env: { PATH: process.env['PATH'] ?? '', VERCEL_AUTOMATION_BYPASS_SECRET: bypass } },
      );
      return { status: 0, stdout, stderr: '' };
    } catch (error) {
      const failed = error as { code: number; stdout: string; stderr: string };
      return { status: failed.code, stdout: failed.stdout, stderr: failed.stderr };
    }
  };

  it('fails closed on a deployment that reports no identity, as one built before it would', async () => {
    const url = await serve(() => undefined);

    const result = await command('identify', { url });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`${url} reports no deployment identity.`);
  });

  it('sends the bypass secret, and fails closed when Deployment Protection turns it away', async () => {
    const url = await serve(() => CURRENT_PRODUCTION);

    const passed = await command('verify', { url, commit: CURRENT_PRODUCTION.commit });
    const refused = await command('verify', { url, commit: CURRENT_PRODUCTION.commit }, '');

    expect(passed.status, passed.stderr).toBe(0);
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain(`${url} answered health.get with HTTP 401.`);
  });

  it('verifies a deployment that reports the commit it was asked about', async () => {
    const url = await serve(() => CURRENT_PRODUCTION);

    const result = await command('verify', { url, commit: CURRENT_PRODUCTION.commit });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(CURRENT_PRODUCTION);
  });

  it('fails a deployment that reports another commit than the one it was asked about', async () => {
    const url = await serve(() => CURRENT_PRODUCTION);

    const result = await command('verify', { url, commit: RELEASE_COMMIT });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`reports commit ${CURRENT_PRODUCTION.commit}, not ${RELEASE_COMMIT}.`);
  });

  it('exposes the compatibility decision as JSON', async () => {
    const result = await command('compatibility', {
      attempt: 1,
      target: CURRENT_PRODUCTION,
      smoke: 'success',
      after: REDEPLOYED,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ decision: 'rerun' });
  });
});
