import { describe, expect, it } from 'vitest';
import {
  deploymentIdentitySchema,
  healthStateSchema,
  healthStatusSchema,
  toHealthStatus,
} from './health';

const CHECKED_AT = new Date('2026-01-01T00:00:00.000Z');

const UNIDENTIFIED = { id: null, commit: null, url: null } as const;

const IDENTIFIED = {
  id: 'dpl_8kQm2rTzLx',
  commit: 'b4a54cc0b4a54cc0b4a54cc0b4a54cc0b4a54cc0',
  url: 'https://credebi-abc123.vercel.app',
} as const;

describe('healthStateSchema', () => {
  it('accepts each state the domain can conclude', () => {
    expect(healthStateSchema.parse('healthy')).toBe('healthy');
    expect(healthStateSchema.parse('degraded')).toBe('degraded');
  });

  it('rejects a state nobody defined, so a typo cannot travel as a status', () => {
    expect(healthStateSchema.safeParse('ok').success).toBe(false);
  });
});

describe('toHealthStatus', () => {
  it('renders the instant as an ISO 8601 string in UTC', () => {
    const status = toHealthStatus({
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    expect(status.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('renders an instant taken in another offset in UTC too', () => {
    const status = toHealthStatus({
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: new Date('2026-01-01T09:00:00+09:00'),
      deployment: UNIDENTIFIED,
    });

    expect(status.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('produces a value the contract itself accepts', () => {
    const status = toHealthStatus({
      status: 'degraded',
      components: [{ name: 'postgres', reachable: false }],
      checkedAt: CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    expect(healthStatusSchema.parse(status)).toEqual(status);
  });

  it('keeps the state and every component, in order', () => {
    const status = toHealthStatus({
      status: 'degraded',
      components: [
        { name: 'postgres', reachable: true },
        { name: 'cache', reachable: false },
      ],
      checkedAt: CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    expect(status.status).toBe('degraded');
    expect(status.components).toEqual([
      { name: 'postgres', reachable: true },
      { name: 'cache', reachable: false },
    ]);
  });

  it('copies the component list rather than handing back the array it was given', () => {
    const components = [{ name: 'postgres', reachable: true }];

    const status = toHealthStatus({
      status: 'healthy',
      components,
      checkedAt: CHECKED_AT,
      deployment: UNIDENTIFIED,
    });
    status.components.push({ name: 'smuggled', reachable: false });

    expect(components).toEqual([{ name: 'postgres', reachable: true }]);
  });

  it('serialises a report with no components, because emptiness is for the domain to reject', () => {
    const status = toHealthStatus({
      status: 'degraded',
      components: [],
      checkedAt: CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    expect(status.components).toEqual([]);
    expect(healthStatusSchema.parse(status)).toEqual(status);
  });

  it('carries the deployment that answered, field by field', () => {
    const status = toHealthStatus({
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: CHECKED_AT,
      deployment: IDENTIFIED,
    });

    expect(status.deployment).toEqual(IDENTIFIED);
    expect(healthStatusSchema.parse(status)).toEqual(status);
  });

  it('reports a deployment it cannot identify as nulls, which the contract accepts', () => {
    const status = toHealthStatus({
      status: 'healthy',
      components: [{ name: 'postgres', reachable: true }],
      checkedAt: CHECKED_AT,
      deployment: UNIDENTIFIED,
    });

    expect(status.status).toBe('healthy');
    expect(status.deployment).toEqual(UNIDENTIFIED);
    expect(healthStatusSchema.parse(status)).toEqual(status);
  });
});

describe('deploymentIdentitySchema', () => {
  it('rejects an empty field, so an unset variable travels as null and never as a blank', () => {
    expect(deploymentIdentitySchema.safeParse({ ...IDENTIFIED, commit: '' }).success).toBe(false);
  });
});
