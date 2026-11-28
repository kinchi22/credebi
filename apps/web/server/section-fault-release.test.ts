import { describe, expect, it } from 'vitest';
import { serveRelease } from './section-fault-release';
import { createSectionFaults, noSectionFaults } from './section-faults';

const params = (
  token: string,
  section: string,
): { params: Promise<{ token: string; section: string }> } => ({
  params: Promise.resolve({ token, section }),
});

const request = new Request('http://localhost/api/e2e/faults/t1/entries.list/release', {
  method: 'POST',
});

describe('releasing a held section', () => {
  it('releases the hold and answers 204', async () => {
    const faults = createSectionFaults(new Map());
    const cookie = encodeURIComponent('t1;entries.list:hold');
    const held = faults.run('entries.list', cookie, () => Promise.resolve('data'));
    const response = await serveRelease(() => faults)(request, params('t1', 'entries.list'));
    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(held).resolves.toBe('data');
  });

  it('answers 404 for a section outside the list', async () => {
    const faults = createSectionFaults(new Map());
    const response = await serveRelease(() => faults)(request, params('t1', 'entries.nope'));
    expect(response.status).toBe(404);
  });

  it('answers 404 when faults are off', async () => {
    const response = await serveRelease(() => noSectionFaults)(
      request,
      params('t1', 'entries.list'),
    );
    expect(response.status).toBe(404);
  });
});
