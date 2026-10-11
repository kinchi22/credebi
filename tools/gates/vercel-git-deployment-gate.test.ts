import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './run-gate';

type GitConfiguration = {
  readonly git: {
    readonly deploymentEnabled: Readonly<Record<string, boolean>>;
  };
};

describe('Vercel Git deployments', () => {
  const configuration = () => JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'apps/web/vercel.json'), 'utf8'),
  ) as GitConfiguration;

  it('disables every branch with an explicit exception for main', () => {
    expect(configuration().git.deploymentEnabled).toEqual({ '**': false, main: true });
  });

  it.each([
    ['main', true],
    ['development', false],
    ['feature/entries', false],
    ['milestone/accounts', false],
    ['feature/accounts/reorder', false],
    ['main/fix', false],
  ])('sets automatic deployment of %s to %s', (branch, expected) => {
    const rules = Object.entries(configuration().git.deploymentEnabled)
      .filter(([pattern]) => path.matchesGlob(branch, pattern));

    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some(([, enabled]) => enabled)).toBe(expected);
  });
});
