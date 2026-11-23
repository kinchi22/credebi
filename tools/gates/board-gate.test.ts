import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readStatus, setStatus, spawnGh, STATUS_NAMES, type BoardEnv, type StatusName } from '../board';

type Call = { readonly args: readonly string[]; readonly env: BoardEnv };

function fakeGh(outputs: readonly string[] = []) {
  const calls: Call[] = [];
  const gh = (args: readonly string[], env: BoardEnv): string => {
    calls.push({ args, env });
    return outputs[calls.length - 1] ?? '';
  };
  return { gh, calls };
}

const missingMessage = /BOARD_TOKEN.*project.*read:org/;

describe('board token', () => {
  it('hands gh the board token over a GH_TOKEN and GITHUB_TOKEN already present', () => {
    const { gh, calls } = fakeGh(['Ready']);
    readStatus(7, { env: { BOARD_TOKEN: 'board', GH_TOKEN: 'app', GITHUB_TOKEN: 'app-too', HOME: '/home' }, gh });
    expect(calls[0]?.env['GH_TOKEN']).toBe('board');
    expect(calls[0]?.env['GITHUB_TOKEN']).toBeUndefined();
    expect(calls[0]?.env['HOME']).toBe('/home');
  });

  it.each([{ BOARD_TOKEN: undefined }, { BOARD_TOKEN: '' }, {}])(
    'throws naming the variable and both scopes, without calling gh, for %j',
    (env) => {
      const read = fakeGh();
      expect(() => readStatus(7, { env: { ...env, GH_TOKEN: 'app' }, gh: read.gh })).toThrow(missingMessage);
      expect(read.calls).toEqual([]);
      const write = fakeGh();
      expect(() => { setStatus(7, 'Ready', { env, gh: write.gh }); }).toThrow(missingMessage);
      expect(write.calls).toEqual([]);
    },
  );

  it('surfaces the message a failing gh runner throws', () => {
    const gh = (): string => {
      throw new Error('unknown owner type');
    };
    expect(() => { setStatus(7, 'Ready', { env: { BOARD_TOKEN: 'board' }, gh }); }).toThrow('unknown owner type');
  });
});

describe('the real gh runner', () => {
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
    expect(() => spawnGh(['api'], { PATH: empty })).toThrow(/gh.*could not be started/);
  });

  it('fails with a message naming the signal when gh is killed', () => {
    const bin = binWith('kill -9 $$');
    expect(() => spawnGh(['api'], { PATH: bin })).toThrow(/gh.*SIGKILL/);
  });

  it('surfaces the stderr of a gh that exits non-zero unchanged', () => {
    const bin = binWith('echo "unknown owner type" >&2\nexit 1');
    expect(() => spawnGh(['api'], { PATH: bin })).toThrow(new Error('unknown owner type\n'));
  });

  it('returns the trimmed stdout of a gh that succeeds', () => {
    const bin = binWith('echo "  Ready  "');
    expect(spawnGh(['api'], { PATH: bin })).toBe('Ready');
  });
});

describe('reading a Status', () => {
  it('returns the Status name gh printed', () => {
    const { gh, calls } = fakeGh(['In Progress']);
    expect(readStatus(7, { env: { BOARD_TOKEN: 'board' }, gh })).toBe('In Progress');
    expect(calls[0]?.args).toContain('number=7');
  });

  it('reports an issue that is not on the board as undefined', () => {
    const { gh } = fakeGh(['']);
    expect(readStatus(7, { env: { BOARD_TOKEN: 'board' }, gh })).toBeUndefined();
  });
});

describe('setting a Status', () => {
  const optionOf = (status: StatusName): string | undefined => {
    const { gh, calls } = fakeGh(['PVTI_item']);
    setStatus(7, status, { env: { BOARD_TOKEN: 'board' }, gh });
    const edit = calls[1]?.args ?? [];
    return edit[edit.indexOf('--single-select-option-id') + 1];
  };

  it('adds the issue to the board then edits the item it returned', () => {
    const { gh, calls } = fakeGh(['PVTI_item']);
    setStatus(7, 'Ready', { env: { BOARD_TOKEN: 'board' }, gh });
    expect(calls[0]?.args).toContain('https://github.com/kinchi22/credebi/issues/7');
    expect(calls[0]?.args.slice(0, 2)).toEqual(['project', 'item-add']);
    expect(calls[1]?.args.slice(0, 2)).toEqual(['project', 'item-edit']);
    expect(calls[1]?.args[calls[1].args.indexOf('--id') + 1]).toBe('PVTI_item');
    expect(calls.every((call) => call.env['GH_TOKEN'] === 'board')).toBe(true);
  });

  it('passes a distinct option id for each Status name', () => {
    const options = STATUS_NAMES.map(optionOf);
    expect(options).toHaveLength(5);
    expect(new Set(options).size).toBe(5);
    expect(optionOf('Ready')).toBe('412e474e');
    expect(optionOf('Done')).toBe('98236657');
  });
});
