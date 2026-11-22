import { readFileSync } from 'node:fs';
import path from 'node:path';

const releaseIndex = 'https://nodejs.org/dist/index.json';
const releaseSchedule = 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json';
const cveRecords = 'https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves';
const advisoryIndex = 'https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json';
const releaseNotes = 'https://raw.githubusercontent.com/nodejs/nodejs.org/main/apps/site/pages/en/blog/release';
const cvePattern = /^CVE-\d{4}-\d{4,}$/;

type Version = { major: number; minor: number; patch: number; text: string };
type Release = { version: Version; security: boolean };
type Advisory = { ids: string[]; vulnerable: string; patched: string; source: string };
type Finding = { id: string; source: string; affectedRange: string; patchedRange: string; fixed: string | undefined };

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
    for (const id of advisory.ids) {
      findings.set(id, { id, source: advisory.source, affectedRange: advisory.vulnerable, patchedRange: advisory.patched, fixed });
    }
  }
  return [...findings.values()];
}

async function lifecycleGap(fetch: typeof globalThis.fetch, pin: Version): Promise<string> {
  const data: unknown = await (await request(fetch, releaseSchedule)).json();
  const line = isRecord(data) ? data[`v${String(pin.major)}`] : undefined;
  const end = isRecord(line) ? line['end'] : undefined;
  if (typeof end !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(Date.parse(end)) || new Date(end).toISOString().slice(0, 10) !== end) {
    return `Node.js ${pin.text} has no valid end date in the release schedule.`;
  }
  return new Date().toISOString().slice(0, 10) >= end
    ? `Node.js ${pin.text} is end of life since ${end}. New advisories may lack coverage for this release line.`
    : '';
}

function cveAffectedRange(row: unknown): string {
  if (!isRecord(row) || row['status'] !== 'affected' || typeof row['version'] !== 'string' ||
    (row['changes'] !== undefined && !(Array.isArray(row['changes']) && row['changes'].length === 0))) {
    throw new Error('Unsupported CNA version data.');
  }
  const start = parseVersion(row['version']);
  const { lessThan, lessThanOrEqual, versionType } = row;
  if (lessThan === undefined && lessThanOrEqual === undefined) return start.text;
  if (versionType !== 'semver' || (lessThan !== undefined && lessThanOrEqual !== undefined)) {
    throw new Error('Unsupported CNA version bounds.');
  }
  if (lessThan === '*') return `>=${start.text}`;
  const bound = lessThan ?? lessThanOrEqual;
  if (typeof bound !== 'string') throw new Error('Missing CNA version bound.');
  const end = parseVersion(bound);
  if (compare(start, end) > 0 || (compare(start, end) === 0 && lessThan !== undefined)) {
    throw new Error('Invalid CNA version bounds.');
  }
  return `>=${start.text} ${lessThan !== undefined ? '<' : '<='}${end.text}`;
}

async function readCveAdvisory(
  fetch: typeof globalThis.fetch,
  pin: Version,
  id: string,
  securityReleases: Version[],
): Promise<Advisory> {
  const [, year = '', sequence = ''] = id.split('-');
  const bucket = String(Number(sequence.slice(0, -3)));
  const record: unknown = await (await request(fetch, `${cveRecords}/${year}/${bucket}xxx/${id}.json`)).json();
  const metadata = isRecord(record) ? record['cveMetadata'] : undefined;
  const containers = isRecord(record) ? record['containers'] : undefined;
  const cna = isRecord(containers) ? containers['cna'] : undefined;
  const provider = isRecord(cna) ? cna['providerMetadata'] : undefined;
  if (!isRecord(metadata) || metadata['cveId'] !== id || metadata['state'] !== 'PUBLISHED' ||
    !isRecord(cna) || !isRecord(provider) || provider['shortName'] !== 'openjs' || !Array.isArray(cna['affected'])) {
    throw new Error('No published OpenJS CNA record.');
  }
  const products = (cna['affected'] as unknown[]).filter((value): value is Record<string, unknown> =>
    isRecord(value) && value['vendor'] === 'nodejs' && value['product'] === 'node');
  const [product] = products;
  if (products.length !== 1 || !product || !Array.isArray(product['versions']) || product['versions'].length === 0) {
    throw new Error('No unambiguous Node.js version data in the CNA record.');
  }
  const vulnerable = (product['versions'] as unknown[]).map(cveAffectedRange).join(' || ');
  const defaultStatus = product['defaultStatus'];
  if (defaultStatus !== 'unaffected' && !matchesRange(pin, vulnerable)) {
    throw new Error('The CNA version ranges do not establish whether the pin is affected.');
  }
  const patched = defaultStatus === 'unaffected'
    ? securityReleases.toSorted(compare).filter((version) => !matchesRange(version, vulnerable)).map(({ text }) => text).join(' || ')
    : '';
  return { ids: [id], vulnerable, patched, source: `https://www.cve.org/CVERecord?id=${id}` };
}

async function releaseCoverage(
  fetch: typeof globalThis.fetch,
  pin: Version,
  releases: Release[],
  advisories: Advisory[],
): Promise<{ fallback: Advisory[]; gaps: string[] }> {
  const gaps: string[] = [];
  const fallback: Advisory[] = [];
  if (!releases.some(({ version }) => compare(version, pin) === 0)) {
    return { fallback, gaps: [`Node.js ${pin.text} is absent from the release index.`] };
  }
  const newerSecurityReleases = releases.filter(({ version, security }) =>
    security && version.major === pin.major && compare(version, pin) > 0);
  const known = new Set(advisories.flatMap(({ ids }) => ids));
  const missing = new Map<string, Version[]>();

  await Promise.all(newerSecurityReleases.map(async ({ version }) => {
    try {
      const notes = await (await request(fetch, `${releaseNotes}/v${version.text}.md`)).text();
      const ids = [...new Set([...notes.matchAll(/\bCVE-\d{4}-\d{4,}\b/g)].map(([id]) => id))];
      if (ids.length === 0) gaps.push(`Node.js ${version.text} security release has no identifiable advisory references.`);
      for (const id of ids.filter((candidate) => !known.has(candidate))) {
        missing.set(id, [...(missing.get(id) ?? []), version]);
      }
    } catch (error) {
      gaps.push(`Node.js ${version.text} security release notes unavailable. ${String(error)}`);
    }
  }));

  await Promise.all([...missing].map(async ([id, versions]) => {
    try {
      fallback.push(await readCveAdvisory(fetch, pin, id, versions));
    } catch (error) {
      gaps.push(`Missing published range data for ${id}. ${String(error)}`);
    }
  }));
  return { fallback, gaps };
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
      `Published affected range: \`${finding.affectedRange}\`.`,
      ...(finding.patchedRange ? [`Published patched range: \`${finding.patchedRange}\`.`] : []),
      `Advisory source: <${finding.source}>.`,
      `Fixed version on this release line: ${finding.fixed ?? (finding.patchedRange ? 'none published' : 'not yet known')}.`,
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
  const [coverage, lifecycle] = await Promise.all([
    releaseCoverage(fetch, pin, releases, advisories),
    lifecycleGap(fetch, pin).catch((error: unknown) => `Node.js release schedule unavailable. ${String(error)}`),
  ]);
  const findings = findAdvisories(pin, releases, [...advisories, ...coverage.fallback]);
  const reported = await publishFindings(fetch, env, pin, findings);
  const gaps = [...coverage.gaps, lifecycle].filter(Boolean);
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
