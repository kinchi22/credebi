import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runSecurityCheck } from '../node-security-check.ts';

const advisoryId = 'CVE-2026-99001';
const gitHub = new URL('https://api.github.com/repos/owner/repo/issues');
const missingAdvisoryId = 'CVE-2026-99002';
const advisorySource = 'https://nodejs.org/en/blog/vulnerability/example';
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function scenario() {
  const directory = mkdtempSync(path.join(tmpdir(), 'node-security-check-'));
  directories.push(directory);
  const pin = (value: string) => { writeFileSync(path.join(directory, '.nvmrc'), value + '\n'); };
  pin('24.22.2');
  const env = { GITHUB_REPOSITORY: 'owner/repo', GITHUB_RUN_ID: '123', GITHUB_TOKEN: 'fixture' };
  const advisories = {
    1: { cve: [advisoryId], vulnerable: '24.x || 26.x', patched: '^24.22.3 || ^26.13.0', ref: advisorySource },
  };
  const releases = [
    { version: 'v24.22.4', security: false },
    { version: 'v24.22.3', security: true },
    { version: 'v24.22.2', security: false },
  ];
  const schedule = { v24: { end: '2099-04-30' } };
  const cve = {
    cveMetadata: { cveId: missingAdvisoryId, state: 'PUBLISHED' },
    containers: { cna: {
      providerMetadata: { shortName: 'openjs' },
      affected: [{
        vendor: 'nodejs',
        product: 'node',
        defaultStatus: 'unaffected',
        versions: [{ status: 'affected', version: '24.0.0', lessThan: '24.22.3', versionType: 'semver' }],
      }],
    } },
  };
  const issues: { number: number; title: string; body: string; state: string; user: { login: string } }[] = [];
  const responses = { releaseNotes: `- (${advisoryId}) A security fix\n`, advisoryStatus: 200, cveStatus: 404 };
  const respond = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/dist/index.json') return Response.json(releases);
    if (url.pathname === '/nodejs/Release/main/schedule.json') return Response.json(schedule);
    if (url.pathname === `/CVEProject/cvelistV5/main/cves/2026/99xxx/${missingAdvisoryId}.json`) {
      return Response.json(cve, { status: responses.cveStatus });
    }
    if (url.pathname === '/nodejs/security-wg/main/vuln/core/index.json') {
      return Response.json(advisories, { status: responses.advisoryStatus });
    }
    if (url.pathname.endsWith('/v24.22.3.md')) return new Response(responses.releaseNotes);
    if (url.origin !== gitHub.origin || !url.pathname.startsWith(gitHub.pathname)) throw new Error('Unexpected request');
    if (init?.method === 'POST' && typeof init.body === 'string') {
      const payload = JSON.parse(init.body) as { title: string; body: string };
      const issue = { ...payload, number: issues.length + 1, state: 'open', user: { login: 'github-actions[bot]' } };
      issues.push(issue);
      return Response.json(issue, { status: 201 });
    }
    if (init?.method === 'PATCH' && typeof init.body === 'string') {
      const issue = issues.find(({ number }) => url.pathname === `${gitHub.pathname}/${String(number)}`);
      if (!issue) return new Response(null, { status: 404 });
      const { body } = JSON.parse(init.body) as { body: string };
      issue.body = body;
      return Response.json(issue);
    }
    return Response.json(issues.filter(({ state }) => url.searchParams.get('state') === 'all' || state === 'open'));
  };
  const fetch: typeof globalThis.fetch = (input, init) => Promise.resolve(respond(input, init));
  return { pin, env, advisories, releases, schedule, cve, issues, responses, run: () => runSecurityCheck(directory, env, fetch) };
}

describe('the daily Node.js security check', () => {
  it('reports the pinned version, advisory source, known fix, and run evidence for an affected release', async () => {
    const fixture = scenario();

    await expect(fixture.run()).resolves.toMatchObject({ findings: 1, created: 1 });
    expect(fixture.issues).toHaveLength(1);
    expect(fixture.issues[0]?.title).toContain(advisoryId);
    expect(fixture.issues[0]?.body).toContain('24.22.2');
    expect(fixture.issues[0]?.body).toContain(advisorySource);
    expect(fixture.issues[0]?.body).toContain('24.22.3');
    expect(fixture.issues[0]?.body).toContain('https://github.com/owner/repo/actions/runs/123');
  });

  it('keeps one issue, including when closed, and updates it when a fix is known', async () => {
    const fixture = scenario();
    fixture.advisories[1].patched = '';
    await expect(fixture.run()).resolves.toMatchObject({ findings: 1, created: 1 });
    const issue = fixture.issues[0];
    expect(issue?.body).toContain('not yet known');
    if (!issue) throw new Error('Missing issue');
    issue.state = 'closed';

    fixture.env.GITHUB_RUN_ID = '124';
    await expect(fixture.run()).resolves.toMatchObject({ findings: 1, created: 0, updated: 0 });
    expect(issue.body).toContain('/runs/123');

    fixture.advisories[1].patched = '^24.22.3 || ^26.13.0';
    await expect(fixture.run()).resolves.toMatchObject({ findings: 1, created: 0, updated: 1 });
    expect(fixture.issues).toHaveLength(1);
    expect(issue.body).toContain('Fixed version on this release line: 24.22.3');
    expect(issue.body).toContain('/runs/124');
    expect(issue.state).toBe('closed');
  });

  it.each([
    ['vulnerable', '>=24.22.0 <24.22.4 || 26.x', 'Published affected range'],
    ['patched', '>=24.22.3 <25.0.0 || ^26.13.0', 'Published patched range'],
  ] as const)('updates the existing issue when the published %s range changes', async (field, range, label) => {
    const fixture = scenario();
    await expect(fixture.run()).resolves.toMatchObject({ created: 1 });

    fixture.advisories[1][field] = range;
    await expect(fixture.run()).resolves.toMatchObject({ created: 0, updated: 1 });
    expect(fixture.issues).toHaveLength(1);
    expect(fixture.issues[0]?.body).toContain(`${label}: \`${range}\`.`);
    expect(fixture.issues[0]?.body).toContain('Fixed version on this release line: 24.22.3');
  });

  it('reports no issue for the patched pin with a newer ordinary release', async () => {
    const fixture = scenario();
    fixture.pin('24.22.3');

    await expect(fixture.run()).resolves.toEqual({ findings: 0, created: 0, updated: 0 });
    expect(fixture.issues).toEqual([]);
  });

  it('uses an explicit affected range and leaves a version before its lower bound alone', async () => {
    const fixture = scenario();
    fixture.advisories[1].vulnerable = '>=24.22.3 <24.22.4 || 26.x';

    await expect(fixture.run()).resolves.toMatchObject({ findings: 0 });
    expect(fixture.issues).toEqual([]);
  });

  it('reports an incomplete check when a security release has an advisory missing from structured data', async () => {
    const fixture = scenario();
    fixture.responses.releaseNotes += `- (${missingAdvisoryId}) Another security fix\n`;

    await expect(fixture.run()).rejects.toThrow(/incomplete.*CVE-2026-99002/);
    expect(fixture.issues).toHaveLength(1);
    expect(fixture.issues[0]?.title).toContain(advisoryId);
  });

  it('uses an OpenJS CVE record when the security release names an advisory missing from the index', async () => {
    const fixture = scenario();
    fixture.responses.releaseNotes += `- (${missingAdvisoryId}) Another security fix\n`;
    fixture.responses.cveStatus = 200;

    await expect(fixture.run()).resolves.toMatchObject({ findings: 2, created: 2 });
    const issue = fixture.issues.find(({ title }) => title.includes(missingAdvisoryId));
    expect(issue?.body).toContain('Published affected range: `>=24.0.0 <24.22.3`.');
    expect(issue?.body).toContain('Fixed version on this release line: 24.22.3.');
    expect(issue?.body).toContain(`https://www.cve.org/CVERecord?id=${missingAdvisoryId}`);
  });

  it('reports incomplete coverage when the available CVE record does not establish applicability', async () => {
    const fixture = scenario();
    fixture.responses.releaseNotes += `- (${missingAdvisoryId}) Another security fix\n`;
    fixture.responses.cveStatus = 200;
    const product = fixture.cve.containers.cna.affected[0];
    if (!product) throw new Error('Missing CVE product');
    product.defaultStatus = 'unknown';
    const range = product.versions[0];
    if (!range) throw new Error('Missing CVE version range');
    range.version = '24.22.3';
    range.lessThan = '24.22.4';

    await expect(fixture.run()).rejects.toThrow(/incomplete.*CVE-2026-99002/);
    expect(fixture.issues).toHaveLength(1);
  });

  it('reports incomplete coverage for an end-of-life major while publishing confirmed findings', async () => {
    const fixture = scenario();
    fixture.schedule.v24.end = '2000-04-30';
    for (const release of fixture.releases) release.security = false;

    await expect(fixture.run()).rejects.toThrow(/incomplete.*end of life/);
    expect(fixture.issues).toHaveLength(1);
    expect(fixture.issues[0]?.title).toContain(advisoryId);
  });

  it('distinguishes a published patch on another release line from an unknown patch', async () => {
    const fixture = scenario();
    fixture.advisories[1].patched = '^26.13.0';

    await expect(fixture.run()).resolves.toMatchObject({ findings: 1 });
    expect(fixture.issues[0]?.body).toContain('Published patched range: `^26.13.0`.');
    expect(fixture.issues[0]?.body).toContain('Fixed version on this release line: none published.');
  });

  it('fails visibly instead of reporting a clean result when the advisory source is unavailable', async () => {
    const fixture = scenario();
    fixture.responses.advisoryStatus = 503;

    await expect(fixture.run()).rejects.toThrow('returned HTTP 503');
    expect(fixture.issues).toEqual([]);
  });
});
