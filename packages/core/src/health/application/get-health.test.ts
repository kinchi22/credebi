import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@repo/contracts';
import { createGetHealth } from './get-health';
import { type HealthProbe } from '../ports/health-probe';

const probe = (name: string, reachable: boolean): HealthProbe => ({
  name,
  check: () => Promise.resolve(reachable),
});

const CHECKED_AT = new Date('2026-01-01T00:00:00.000Z');

const UNIDENTIFIED = { id: null, commit: null, url: null } as const;

describe('createGetHealth', () => {
  it('aggregates every probe into a single status', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true), probe('cache', true)],
      now: () => CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('healthy');
    expect(result.value.components.map((component) => component.name)).toEqual([
      'postgres',
      'cache',
    ]);
  });

  it('degrades the whole status when one probe fails', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true), probe('cache', false)],
      now: () => CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('degraded');
  });

  it('stamps the result with the injected clock', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true)],
      now: () => CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.checkedAt).toEqual(CHECKED_AT);
  });

  it('names the deployment that answered, whatever the probes say', async () => {
    const deployment = {
      id: 'dpl_8kQm2rTzLx',
      commit: 'b4a54cc0b4a54cc0b4a54cc0b4a54cc0b4a54cc0',
      url: 'https://credebi-abc123.vercel.app',
    };
    const getHealth = createGetHealth({
      probes: [probe('postgres', false)],
      now: () => CHECKED_AT,
      deployment,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('degraded');
    expect(result.value.deployment).toEqual(deployment);
  });

  it('stays healthy when the deployment cannot be identified', async () => {
    const getHealth = createGetHealth({
      probes: [probe('postgres', true)],
      now: () => CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    const result = await getHealth();

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe('healthy');
    expect(result.value.deployment).toEqual(UNIDENTIFIED);
  });

  it('refuses to report health with no probe, deployment or not', async () => {
    const getHealth = createGetHealth({
      probes: [],
      now: () => CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    const result = await getHealth();

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });
});
