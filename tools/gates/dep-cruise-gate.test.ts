import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEP_CRUISE_FIXTURES } from './fixture-map';
import { bin, REPO_ROOT, runGate, VIOLATIONS_DIR } from './run-gate';

const scriptedRoots = (): readonly string[] => {
  const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts: Readonly<Record<string, string>>;
  };
  const [command, ...args] = (manifest.scripts['dep-cruise'] ?? '').split(/\s+/);
  expect(command, 'the dep-cruise script must run depcruise').toBe('depcruise');
  const firstOption = args.findIndex((arg) => arg.startsWith('-'));
  return firstOption === -1 ? args : args.slice(0, firstOption);
};

describe('dependency-cruiser gate liveness', () => {
  const roots = scriptedRoots();
  const run = runGate(
    bin('depcruise'),
    [...roots, '--config', '.dependency-cruiser.cjs'],
    VIOLATIONS_DIR,
  );

  it('cruises every root the dep-cruise script names, e2e and tools among them', () => {
    expect(roots).toEqual(expect.arrayContaining(['packages', 'apps', 'e2e', 'tools']));
  });

  it('exits non-zero on the violation fixtures', () => {
    expect(run.status).not.toBe(0);
  });

  it.each(DEP_CRUISE_FIXTURES)('%s is reported for %s', (ruleName, file) => {
    expect(run.stdout).toContain(ruleName);
    expect(run.stdout).toContain(file);
  });

  it.each([
    ['packages/core/src/ledger/domain/cycle-a.ts', 'packages/core/src/ledger/domain/cycle-b.ts'],
    ['e2e/cycle-a.ts', 'e2e/cycle-b.ts'],
    ['tools/cycle-a.ts', 'tools/cycle-b.ts'],
  ])('names both halves of the cycle through %s and %s', (first, second) => {
    const cycles = run.stdout
      .split(/\n(?=\s*(?:error|warn|info) )/)
      .filter((violation) => violation.includes('no-circular:'));
    expect(cycles.some((cycle) => cycle.includes(first) && cycle.includes(second))).toBe(true);
  });
});
