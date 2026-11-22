import { readFileSync } from 'node:fs';
import path from 'node:path';

const releaseIndex = 'https://nodejs.org/dist/index.json';
const advisoryIndex = 'https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json';
const releaseNotes = 'https://raw.githubusercontent.com/nodejs/nodejs.org/main/apps/site/pages/en/blog/release';
const cvePattern = /^CVE-\d{4}-\d{4,}$/;

type Version = { major: number; minor: number; patch: number; text: string };
type Release = { version: Version; security: boolean };
type Advisory = { ids: string[]; vulnerable: string; patched: string; source: string };
type Finding = { id: string; source: string; fixed: string | undefined };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseVersion(value: string): Version {
  const text = value.replace(/^v/, '');
  const parts = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(text);
  if (!parts) throw new Error(`Expected a stable Node.js version, found "${value}".`);
  const [, major, minor, patch] = parts;
  return { major: Number(major), minor: Number(minor), patch: Number(patch), text };
}

function compare(left: Version, right: Version): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function matchesComparator(version: Version, token: string): boolean {
  if (token === '*') return true;
  const match = /^(\^|>=|<=|>|<|=)?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i.exec(token);
  if (!match) throw new Error(`Unsupported Node.js advisory range term "${token}".`);
  const [, operation, major = '', minor, patch] = match;
  const hasMinor = minor !== undefined && /^\d+$/.test(minor);
  const hasPatch = patch !== undefined && /^\d+$/.test(patch);
  if (hasPatch && !hasMinor) throw new Error(`Invalid Node.js advisory range term "${token}".`);
  const floor = parseVersion(`${major}.${hasMinor ? minor : '0'}.${hasPatch ? patch : '0'}`);
  const relation = compare(version, floor);
  const partialRelation = hasPatch
    ? relation
    : version.major - floor.major || (hasMinor ? version.minor - floor.minor : 0);
  switch (operation) {
    case '^':
      return relation >= 0 && version.major === floor.major &&
        (floor.major !== 0 || (version.minor === floor.minor && (floor.minor !== 0 || version.patch === floor.patch)));
    case '>=': return relation >= 0;
    case '<=': return partialRelation <= 0;
    case '>': return partialRelation > 0;
    case '<': return relation < 0;
    default: return partialRelation === 0;
  }
}

function matchesRange(version: Version, range: string): boolean {
  if (range.trim() === '') return false;
  return range.split('||').map((part) => part.trim().replace(/([<>]=?|\^|=)\s+/g, '$1')
    .split(/\s+/).map((term) => matchesComparator(version, term)).every(Boolean)).some(Boolean);
}

function parseReleases(data: unknown): Release[] {
  if (!Array.isArray(data) || data.length === 0) throw new Error('Node.js release index is empty or invalid.');
  return data.flatMap((value: unknown) => {
    if (!isRecord(value) || typeof value['version'] !== 'string' || typeof value['security'] !== 'boolean') {
      throw new Error('Node.js release index contains an invalid entry.');
    }
    return value['version'].includes('-') ? [] : [{ version: parseVersion(value['version']), security: value['security'] }];
  }).sort((left, right) => compare(left.version, right.version));
}

function parseAdvisories(data: unknown): Advisory[] {
  if (!isRecord(data) || Object.keys(data).length === 0) throw new Error('Node.js advisory index is empty or invalid.');
  return Object.entries(data).map(([id, value]) => {
    if (!/^\d+$/.test(id) || !isRecord(value)) throw new Error('Node.js advisory index contains an invalid entry.');
    const { cve, vulnerable, patched, ref } = value;
    if (!Array.isArray(cve) || !cve.every((entry: unknown): entry is string =>
      typeof entry === 'string' && cvePattern.test(entry)) || typeof vulnerable !== 'string' || !vulnerable.trim() ||
      !(typeof patched === 'string' || patched === null || patched === undefined)) {
      throw new Error(`Node.js advisory ${id} is missing valid affected or patched range data.`);
    }
    const source = typeof ref === 'string' ? URL.parse(ref) : null;
    return {
      ids: cve.length > 0 ? cve : [`node-core-${id}`],
      vulnerable,
      patched: patched ?? '',
      source: source?.protocol === 'https:' ? source.href : advisoryIndex,
    };
  });
}

async function request(fetch: typeof globalThis.fetch, url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${String(response.status)}.`);
  return response;
}

function findAdvisories(pin: Version, releases: Release[], advisories: Advisory[]): Finding[] {
  const findings = new Map<string, Finding>();
  for (const advisory of advisories) {
    if (!matchesRange(pin, advisory.vulnerable) || matchesRange(pin, advisory.patched)) continue;
    const fixed = releases.find(({ version }) => version.major === pin.major &&
      compare(version, pin) > 0 && matchesRange(version, advisory.patched))?.version.text;
    for (const id of advisory.ids) findings.set(id, { id, source: advisory.source, fixed });
  }
  return [...findings.values()];
}

async function releaseCoverage(
  fetch: typeof globalThis.fetch,
  pin: Version,
  releases: Release[],
  advisories: Advisory[],
): Promise<string[]> {
  if (!releases.some(({ version }) => compare(version, pin) === 0)) {
    return [`Node.js ${pin.text} is absent from the release index.`];
  }
  const newerSecurityReleases = releases.filter(({ version, security }) =>
    security && version.major === pin.major && compare(version, pin) > 0);
  const known = new Set(advisories.flatMap(({ ids }) => ids));
  const results = await Promise.all(newerSecurityReleases.map(async ({ version }) => {
    const notes = await (await request(fetch, `${releaseNotes}/v${version.text}.md`)).text();
    const ids = [...new Set([...notes.matchAll(/\bCVE-\d{4}-\d{4,}\b/g)].map(([id]) => id))];
    if (ids.length === 0) return `Node.js ${version.text} security release has no identifiable advisory references.`;
    const missing = ids.filter((id) => !known.has(id));
    return missing.length > 0 ? `Node.js ${version.text} is missing published range data for ${missing.join(', ')}.` : '';
  }));
  return results.filter(Boolean);
}

async function publishFindings(
  fetch: typeof globalThis.fetch,
  env: NodeJS.ProcessEnv,
  pin: Version,
  findings: Finding[],
): Promise<{ created: number; updated: number }> {
  const result = { created: 0, updated: 0 };
  if (findings.length === 0) return result;
  const { GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: run, GITHUB_TOKEN: token } = env;
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !run || !/^\d+$/.test(run) || !token) {
    throw new Error('GitHub repository, run ID, and issue token are required to report findings.');
  }
  const endpoint = `https://api.github.com/repos/${repository}/issues`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const existing = new Map<string, { number: number; body: string }>();
  for (let page = 1; ; page++) {
    const response = await request(fetch, `${endpoint}?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=${String(page)}`, { headers });
    const issues: unknown = await response.json();
    if (!Array.isArray(issues)) throw new Error('GitHub returned an invalid issue list.');
    for (const issue of issues as unknown[]) {
      if (!isRecord(issue) || 'pull_request' in issue) continue;
      const { body, number, user } = issue;
      if (typeof body !== 'string' || typeof number !== 'number' || !Number.isSafeInteger(number) ||
        !isRecord(user) || user['login'] !== 'github-actions[bot]') continue;
      const marker = /^<!-- node-security-advisory: ([\w-]+) -->/.exec(body)?.[1];
      if (marker) existing.set(marker, { number, body });
    }
    if (issues.length < 100) break;
  }

  for (const finding of findings) {
    const title = `Node.js security advisory: ${finding.id}`;
    const summary = [
      `<!-- node-security-advisory: ${finding.id} -->`,
      '',
      `Pinned Node.js version affected: \`${pin.text}\`.`,
      `Advisory source: <${finding.source}>.`,
      `Fixed version on this release line: ${finding.fixed ?? 'not yet known'}.`,
    ].join('\n');
    const body = `${summary}\n\nRun evidence: https://github.com/${repository}/actions/runs/${run}\n`;
    const previous = existing.get(finding.id);
    if (previous?.body.startsWith(`${summary}\n\nRun evidence: `)) continue;
    await request(fetch, previous ? `${endpoint}/${String(previous.number)}` : endpoint, {
      method: previous ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify({ title, body }),
    });
    if (previous) result.updated++;
    else result.created++;
  }
  return result;
}

export async function runSecurityCheck(
  directory = process.cwd(),
  env = process.env,
  fetch = globalThis.fetch,
): Promise<{ findings: number; created: number; updated: number }> {
  const pin = parseVersion(readFileSync(path.join(directory, '.nvmrc'), 'utf8').trim());
  const [releases, advisories] = await Promise.all([
    request(fetch, releaseIndex).then(async (response) => parseReleases(await response.json())),
    request(fetch, advisoryIndex).then(async (response) => parseAdvisories(await response.json())),
  ]);
  const coverage = releaseCoverage(fetch, pin, releases, advisories).catch((error: unknown) => [String(error)]);
  const findings = findAdvisories(pin, releases, advisories);
  const reported = await publishFindings(fetch, env, pin, findings);
  const gaps = await coverage;
  if (gaps.length > 0) {
    throw new Error(`Node.js security check incomplete after reporting ${String(findings.length)} confirmed finding(s). ${gaps.join(' ')}`);
  }
  return { findings: findings.length, ...reported };
}

if (import.meta.main) {
  try {
    const { findings, created, updated } = await runSecurityCheck();
    console.log(`Node.js security check complete. Confirmed findings: ${String(findings)}. Issues created: ${String(created)}. Issues updated: ${String(updated)}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
