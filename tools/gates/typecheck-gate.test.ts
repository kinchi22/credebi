import { describe, expect, it } from 'vitest';
import { bin, runGate, VIOLATIONS_DIR } from './run-gate';

describe('typecheck gate liveness', () => {
  it('rejects a deep import that reaches past a package public surface', () => {
    const run = runGate(bin('tsc'), ['-p', 'tsconfig.json', '--noEmit'], VIOLATIONS_DIR);

    expect(run.status, 'tsc must exit non-zero').not.toBe(0);
    expect(run.stdout).toContain('apps/web/server/deep-import.ts');
    expect(run.stdout).toContain('TS2307');
    expect(run.stdout).toContain('@repo/core/src/health/domain/status');
  });

  it('rejects a node-run script importing a relative module without its extension', () => {
    const run = runGate(bin('tsc'), ['-p', 'tsconfig.node.json', '--noEmit'], VIOLATIONS_DIR);

    expect(run.status, 'tsc must exit non-zero').not.toBe(0);
    expect(run.stdout).toContain('tools/node-script.ts');
    expect(run.stdout).toContain('TS2835');
  });
});
