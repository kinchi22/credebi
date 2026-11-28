import { describe, expect, it } from 'vitest';
import {
  SECTIONS,
  SECTION_FAULTS_COOKIE,
  createSectionFaults,
  isSection,
  noSectionFaults,
  type SectionFaults,
} from './section-faults';

function cookieOf(token: string, faults: string): string {
  return `${token};${faults}`;
}

function settled(promise: Promise<unknown>): Promise<boolean> {
  return Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(false);
      }, 20);
    }),
  ]);
}

const read = (): Promise<string> => Promise.resolve('data');

function faults(): SectionFaults {
  return createSectionFaults(new Map());
}

describe('section faults', () => {
  it('names the closed list of sections', () => {
    expect(SECTIONS).toHaveLength(10);
    expect(isSection('entries.list')).toBe(true);
    expect(isSection('entries.nope')).toBe(false);
  });

  it('reads the cookie named credebi-faults', () => {
    expect(SECTION_FAULTS_COOKIE).toBe('credebi-faults');
  });

  it('reads through when there is no cookie', async () => {
    await expect(faults().run('entries.list', undefined, read)).resolves.toBe('data');
  });

  it('reads through for a section the cookie does not name', async () => {
    const cookie = cookieOf('t1', 'entries.form:fail,entries.list:hold');
    await expect(faults().run('settings.language', cookie, read)).resolves.toBe('data');
  });

  it.each([
    ['a cookie with no section list', 't1'],
    ['a cookie with no token', ';entries.list:fail'],
    ['a cookie with extra parts', 't1;entries.list:fail;more'],
    ['an unknown section', cookieOf('t1', 'entries.nope:fail')],
    ['an unknown mode', cookieOf('t1', 'entries.list:slow')],
    ['a mode with no section', cookieOf('t1', 'fail')],
  ])('ignores %s', async (_name, cookie) => {
    await expect(faults().run('entries.list', cookie, read)).resolves.toBe('data');
  });

  it('fails the named section and leaves its neighbours alone', async () => {
    const cookie = cookieOf('t1', 'entries.list:fail,entries.form:hold');
    const f = faults();
    await expect(f.run('entries.list', cookie, read)).rejects.toThrow('Injected section fault.');
    expect(await settled(f.run('entries.form', cookie, read))).toBe(false);
  });

  it('holds the read until it is released, then answers it', async () => {
    const f = faults();
    const cookie = cookieOf('t1', 'entries.list:hold');
    const held = f.run('entries.list', cookie, read);
    expect(await settled(held)).toBe(false);
    expect(f.release('t1', 'entries.list')).toBe(true);
    await expect(held).resolves.toBe('data');
  });

  it('does not run the read while it is held', async () => {
    const f = faults();
    let reads = 0;
    const counted = (): Promise<number> => Promise.resolve(++reads);
    const held = f.run('entries.list', cookieOf('t1', 'entries.list:hold'), counted);
    await settled(held);
    expect(reads).toBe(0);
    f.release('t1', 'entries.list');
    await held;
    expect(reads).toBe(1);
  });

  it('keeps a release sticky for later requests and for a release that came first', async () => {
    const f = faults();
    f.release('t1', 'entries.list');
    const cookie = cookieOf('t1', 'entries.list:hold');
    await expect(f.run('entries.list', cookie, read)).resolves.toBe('data');
    await expect(f.run('entries.list', cookie, read)).resolves.toBe('data');
  });

  it('keeps one token apart from another and one section from another', async () => {
    const f = faults();
    const held = f.run('entries.list', cookieOf('t1', 'entries.list:hold'), read);
    f.release('t2', 'entries.list');
    f.release('t1', 'entries.form');
    expect(await settled(held)).toBe(false);
    f.release('t1', 'entries.list');
    await expect(held).resolves.toBe('data');
  });

  it('refuses to release a section it does not know', () => {
    expect(faults().release('t1', 'entries.nope')).toBe(false);
  });

  it('does nothing when faults are off', async () => {
    const cookie = cookieOf('t1', 'entries.list:fail');
    await expect(noSectionFaults.run('entries.list', cookie, read)).resolves.toBe('data');
    expect(noSectionFaults.release('t1', 'entries.list')).toBe(false);
  });
});
