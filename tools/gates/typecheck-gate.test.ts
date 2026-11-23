import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bin, REPO_ROOT, runGate, VIOLATIONS_DIR } from './run-gate';

describe('typecheck gate liveness', () => {
  it('rejects a deep import that reaches past a package public surface', () => {
    const run = runGate(bin('tsc'), ['-p', 'tsconfig.json', '--noEmit'], VIOLATIONS_DIR);

    expect(run.status, 'tsc must exit non-zero').not.toBe(0);
    expect(run.stdout).toContain('apps/web/server/deep-import.ts');
    expect(run.stdout).toContain('TS2307');
    expect(run.stdout).toContain('@repo/core/src/health/domain/status');
  });

  it('rejects a node-run script importing a relative module without its extension', () => {
    const run = runGate(bin('tsc'), ['-p', 'tsconfig.node-scripts.json', '--noEmit'], VIOLATIONS_DIR);

    expect(run.status, 'tsc must exit non-zero').not.toBe(0);
    expect(run.stdout).toContain('tools/extensionless-relative-import.ts');
    expect(run.stdout).toContain('TS2835');
  });

  it('runs the node-run scripts pass as part of typecheck', () => {
    const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Readonly<Record<string, string>>;
    };

    expect(manifest.scripts['typecheck']).toContain('tsc -p tsconfig.node-scripts.json');
  });
});
