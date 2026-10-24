import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_PREREQUISITES = ['Gates', 'Integration'] as const;
export type RequiredPrerequisite = (typeof REQUIRED_PREREQUISITES)[number];

export const PREREQUISITE_OUTCOMES = ['success', 'failure', 'cancelled', 'skipped'] as const;
export type PrerequisiteOutcome = (typeof PREREQUISITE_OUTCOMES)[number];

export const MIGRATION_STATES = ['none', 'pending', 'unknown'] as const;
export type MigrationState = (typeof MIGRATION_STATES)[number];

export const MIGRATION_REASONS = [
  'missing-applied-commit',
  'uncomparable-applied-commit',
] as const;
export type MigrationReason = (typeof MIGRATION_REASONS)[number];

export const MIGRATION_OUTCOMES = [
  'not-started',
  'running',
  'success',
  'failure',
  'cancelled',
  'skipped',
  'skipped-no-migration',
] as const;
export type MigrationOutcome = (typeof MIGRATION_OUTCOMES)[number];

export type Prerequisite = {
  readonly name: RequiredPrerequisite;
  readonly outcome: PrerequisiteOutcome;
};

export type Migration = {
  readonly state: MigrationState;
  readonly reason?: MigrationReason;
  readonly outcome: MigrationOutcome;
};

export type ReleaseInput = {
  readonly prerequisites: readonly Prerequisite[];
  readonly migration: Migration;
};

export type ReleaseDecision = {
  readonly decision:
    | 'fail'
    | 'wait'
    | 'request-approval'
    | 'record-migration-success'
    | 'production-ready';
  readonly reason: string;
};

export type ReleaseQueueInput = {
  readonly runningCommit: string | null;
  readonly waitingCommits: readonly string[];
};

export type ReleaseQueueDecision = {
  readonly runningCommit: string | null;
  readonly cancelRunning: false;
  readonly waitingCommit: string | null;
  readonly waitingDecision: 'recalculate-now' | 'recalculate-after-running' | null;
};

export function selectReleaseCommit(commit: string, mainHead: string | undefined): { current: boolean } {
  return { current: mainHead !== undefined && commit === mainHead };
}

export function coalesceProductionReleases(input: ReleaseQueueInput): ReleaseQueueDecision {
  const waitingCommit = input.waitingCommits.at(-1) ?? null;
  return {
    runningCommit: input.runningCommit,
    cancelRunning: false,
    waitingCommit,
    waitingDecision:
      waitingCommit === null
        ? null
        : input.runningCommit === null
          ? 'recalculate-now'
          : 'recalculate-after-running',
  };
}

export function decideProductionRelease(input: ReleaseInput): ReleaseDecision {
  for (const name of REQUIRED_PREREQUISITES) {
    const prerequisites = input.prerequisites.filter((candidate) => candidate.name === name);
    const prerequisite = prerequisites[0];
    if (prerequisite === undefined) {
      return {
        decision: 'fail',
        reason: `${name} result is missing; Production is not ready.`,
      };
    }
    if (prerequisites.length !== 1) {
      return {
        decision: 'fail',
        reason: `${name} result is duplicated; Production is not ready.`,
      };
    }
    if (prerequisite.outcome !== 'success') {
      return {
        decision: 'fail',
        reason: `${prerequisite.name} was ${prerequisite.outcome}; Production is not ready.`,
      };
    }
  }

  if (input.migration.state === 'unknown') {
    return {
      decision: 'request-approval',
      reason: `Migration state is unknown (${input.migration.reason ?? 'unspecified'}); Production approval is required.`,
    };
  }

  if (input.migration.state === 'none') {
    if (input.migration.outcome === 'skipped-no-migration') {
      return {
        decision: 'production-ready',
        reason: 'No migration is pending; the intentional migration skip is valid.',
      };
    }
    if (input.migration.outcome === 'success') {
      return {
        decision: 'production-ready',
        reason: 'Migration success is already recorded and every prerequisite succeeded.',
      };
    }
    if (input.migration.outcome === 'skipped') {
      return {
        decision: 'fail',
        reason: 'The migration prerequisite was skipped without a no-migration decision.',
      };
    }
  }

  if (input.migration.state === 'pending') {
    if (input.migration.outcome === 'not-started') {
      return {
        decision: 'request-approval',
        reason: 'A Production migration is pending and requires approval.',
      };
    }
    if (input.migration.outcome === 'running') {
      return {
        decision: 'wait',
        reason: 'The Production migration is running and must not be cancelled.',
      };
    }
    if (input.migration.outcome === 'success') {
      return {
        decision: 'record-migration-success',
        reason:
          'The Production migration succeeded; record its commit before downstream checks.',
      };
    }
  }

  return {
    decision: 'fail',
    reason: `The Production migration was ${input.migration.outcome}; Production is not ready.`,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(value: unknown, choices: readonly T[]): value is T =>
  typeof value === 'string' && choices.includes(value as T);

export const COMPATIBILITY_ATTEMPTS = 2;

export type VerifiedDeployment = {
  readonly id: string;
  readonly commit: string;
  readonly url: string;
};

export type DeploymentReading =
  | { readonly ok: true; readonly identity: VerifiedDeployment }
  | { readonly ok: false; readonly reason: string };

export const SMOKE_OUTCOMES = ['success', 'failure'] as const;

export type CompatibilityInput = {
  readonly attempt: number;
  readonly target: VerifiedDeployment;
  readonly smoke: (typeof SMOKE_OUTCOMES)[number];
  readonly after: VerifiedDeployment | null;
};

export type CompatibilityDecision = {
  readonly decision: 'pass' | 'fail' | 'rerun';
  readonly reason: string;
};

const FULL_SHA = /^[0-9a-f]{40}$/;

function isFixedUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.host !== '' && `${url.protocol}//${url.host}` === value;
  } catch {
    return false;
  }
}

export function readHealthDeployment(source: string, body: unknown): DeploymentReading {
  const result = isRecord(body) ? body['result'] : undefined;
  const data = isRecord(result) ? result['data'] : undefined;
  return verifyDeployment(source, isRecord(data) ? data['deployment'] : undefined);
}

export function verifyDeployment(source: string, deployment: unknown): DeploymentReading {
  if (!isRecord(deployment)) {
    return { ok: false, reason: `${source} reports no deployment identity.` };
  }
  const { id, commit, url } = deployment;
  if (typeof id !== 'string' || id === '') {
    return { ok: false, reason: `${source} reports no deployment id.` };
  }
  if (typeof commit !== 'string' || !FULL_SHA.test(commit)) {
    return { ok: false, reason: `${source} reports no full commit SHA.` };
  }
  if (!isFixedUrl(url)) {
    return { ok: false, reason: `${source} reports no HTTPS fixed URL.` };
  }
  return { ok: true, identity: { id, commit, url } };
}

const sameIdentity = (left: VerifiedDeployment, right: VerifiedDeployment): boolean =>
  left.id === right.id && left.commit === right.commit && left.url === right.url;

export function crossCheckIdentity(domain: DeploymentReading, fixed: DeploymentReading): DeploymentReading {
  if (!domain.ok) return domain;
  if (!fixed.ok) return fixed;
  if (!sameIdentity(domain.identity, fixed.identity)) {
    return {
      ok: false,
      reason: `${domain.identity.url} reports deployment ${fixed.identity.id} at ${fixed.identity.commit}, not the ${domain.identity.id} at ${domain.identity.commit} the production domain named.`,
    };
  }
  return domain;
}

export function checkSelfReport(reported: DeploymentReading, expectedCommit: string): DeploymentReading {
  if (!reported.ok) return reported;
  if (reported.identity.commit !== expectedCommit) {
    return {
      ok: false,
      reason: `${reported.identity.url} reports commit ${reported.identity.commit}, not ${expectedCommit}.`,
    };
  }
  return reported;
}

export function decideCompatibility(input: CompatibilityInput): CompatibilityDecision {
  if (input.after === null) {
    return {
      decision: 'fail',
      reason: 'Current Production could not be identified again after its smoke run; the result is not accepted.',
    };
  }
  if (!sameIdentity(input.target, input.after)) {
    const change = `Current Production changed from ${input.target.id} at ${input.target.commit} to ${input.after.id} at ${input.after.commit} during its smoke run`;
    return input.attempt < COMPATIBILITY_ATTEMPTS
      ? { decision: 'rerun', reason: `${change}; smoking the new one.` }
      : { decision: 'fail', reason: `${change} again; the result is not accepted.` };
  }
  return input.smoke === 'success'
    ? {
        decision: 'pass',
        reason: `Current Production passed its own smoke specs at ${input.target.commit} on the resulting schema.`,
      }
    : {
        decision: 'fail',
        reason: `Current Production failed its own smoke specs at ${input.target.commit} on the resulting schema.`,
      };
}

function parseInput(source: string | undefined): unknown {
  if (source === undefined || source.trim() === '') {
    throw new Error('Production release input must be a JSON argument.');
  }
  return JSON.parse(source) as unknown;
}

function isReleaseInput(value: unknown): value is ReleaseInput {
  if (!isRecord(value) || !Array.isArray(value['prerequisites']) || !isRecord(value['migration'])) {
    return false;
  }
  const prerequisites = value['prerequisites'];
  const migration = value['migration'];
  return (
    prerequisites.every(
      (item) =>
        isRecord(item) &&
        isOneOf(item['name'], REQUIRED_PREREQUISITES) &&
        isOneOf(item['outcome'], PREREQUISITE_OUTCOMES),
    ) &&
    isOneOf(migration['state'], MIGRATION_STATES) &&
    isOneOf(migration['outcome'], MIGRATION_OUTCOMES) &&
    (migration['reason'] === undefined || isOneOf(migration['reason'], MIGRATION_REASONS))
  );
}

function isQueueInput(value: unknown): value is ReleaseQueueInput {
  return (
    isRecord(value) &&
    (typeof value['runningCommit'] === 'string' || value['runningCommit'] === null) &&
    Array.isArray(value['waitingCommits']) &&
    value['waitingCommits'].every((commit) => typeof commit === 'string')
  );
}

function isCurrentInput(value: unknown): value is { commit: string; mainHead?: string } {
  return isRecord(value) && typeof value['commit'] === 'string' &&
    (value['mainHead'] === undefined || typeof value['mainHead'] === 'string');
}

function isCompatibilityInput(value: unknown): value is CompatibilityInput {
  return (
    isRecord(value) &&
    typeof value['attempt'] === 'number' &&
    verifyDeployment('target', value['target']).ok &&
    isOneOf(value['smoke'], SMOKE_OUTCOMES) &&
    (value['after'] === null || verifyDeployment('after', value['after']).ok)
  );
}

const isIdentifyInput = (value: unknown): value is { url: string } =>
  isRecord(value) && typeof value['url'] === 'string';

const isVerifyInput = (value: unknown): value is { url: string; commit: string } =>
  isRecord(value) && typeof value['url'] === 'string' && typeof value['commit'] === 'string';

async function fetchIdentity(url: string): Promise<DeploymentReading> {
  const endpoint = new URL('/api/trpc/health.get', url);
  const bypass = process.env['VERCEL_AUTOMATION_BYPASS_SECRET'] ?? '';
  try {
    const response = await fetch(endpoint, {
      headers: bypass === '' ? {} : { 'x-vercel-protection-bypass': bypass },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return { ok: false, reason: `${url} answered health.get with HTTP ${String(response.status)}.` };
    }
    return readHealthDeployment(url, await response.json());
  } catch (error) {
    return {
      ok: false,
      reason: `${url} could not be asked for its identity: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function identify(url: string): Promise<DeploymentReading> {
  const domain = await fetchIdentity(url);
  if (!domain.ok) return domain;
  return crossCheckIdentity(domain, await fetchIdentity(domain.identity.url));
}

function publishDeployment(result: DeploymentReading): void {
  if (!result.ok) {
    console.error(result.reason);
    process.exitCode = 1;
    return;
  }
  publish(result.identity);
}

function publish(
  result:
    | ReleaseDecision
    | ReleaseQueueDecision
    | CompatibilityDecision
    | VerifiedDeployment
    | { current: boolean },
): void {
  console.log(JSON.stringify(result));
  const output = process.env['GITHUB_OUTPUT'];
  if (output !== undefined && output !== '') {
    appendFileSync(
      output,
      Object.entries(result)
        .map(([name, value]) => `${name}=${String(value ?? '')}`)
        .join('\n') + '\n',
    );
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && pathToFileURL(path.resolve(entryPoint)).href === import.meta.url) {
  const command = process.argv[2];
  const input = parseInput(process.argv[3]);
  if (command === 'decide' && isReleaseInput(input)) {
    publish(decideProductionRelease(input));
  } else if (command === 'queue' && isQueueInput(input)) {
    publish(coalesceProductionReleases(input));
  } else if (command === 'current' && isCurrentInput(input)) {
    publish(selectReleaseCommit(input.commit, input.mainHead));
  } else if (command === 'compatibility' && isCompatibilityInput(input)) {
    publish(decideCompatibility(input));
  } else if (command === 'identify' && isIdentifyInput(input)) {
    publishDeployment(await identify(input.url));
  } else if (command === 'verify' && isVerifyInput(input)) {
    publishDeployment(checkSelfReport(await fetchIdentity(input.url), input.commit));
  } else {
    throw new Error(
      'Expected `decide`, `queue`, `current`, `compatibility`, `identify` or `verify` and an input matching that command.',
    );
  }
}
