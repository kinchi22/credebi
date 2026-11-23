import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGh } from '../gh';

describe('the gh runner', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const binWith = (script: string): string => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fake-gh-'));
    dirs.push(dir);
    const file = path.join(dir, 'gh');
    writeFileSync(file, `#!/bin/sh\n${script}\n`);
    chmodSync(file, 0o755);
    return dir;
  };

  it('fails with a message naming gh when it cannot be started', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'no-gh-'));
    dirs.push(empty);
    expect(() => runGh(['api'], { PATH: empty })).toThrow(/gh.*could not be started/);
  });

  it('fails with a message naming the signal when gh is killed', () => {
    const bin = binWith('kill -9 $$');
    expect(() => runGh(['api'], { PATH: bin })).toThrow(/gh.*SIGKILL/);
  });

  it('surfaces the stderr of a gh that exits non-zero unchanged', () => {
    const bin = binWith('echo "unknown owner type" >&2\nexit 1');
    expect(() => runGh(['api'], { PATH: bin })).toThrow(new Error('unknown owner type\n'));
  });

  it('names the exit status of a gh that exits non-zero with no stderr', () => {
    const bin = binWith('exit 3');
    expect(() => runGh(['api'], { PATH: bin })).toThrow('gh exited with status 3');
  });

  it('reports an output overflow as such, not as a failure to start', () => {
    const bin = binWith("i=0\nwhile [ $i -lt 2000 ]; do printf '%01000d' 0; i=$((i+1)); done");
    expect(() => runGh(['api'], { PATH: bin })).toThrow(/more output than the buffer/);
    expect(() => runGh(['api'], { PATH: bin })).not.toThrow(/could not be started/);
  });

  it('returns the trimmed stdout of a gh that succeeds', () => {
    const bin = binWith('echo "  Ready  "');
    expect(runGh(['api'], { PATH: bin })).toBe('Ready');
  });
});
