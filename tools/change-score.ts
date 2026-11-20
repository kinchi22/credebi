import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import stryker from '../stryker.config.ts';
import { findMergeBase, git } from './run-advisory-specs.ts';

export const CHANGE_TARGET = 95;

export const REPORT_DIR = 'reports/mutation';
export const STRYKER_JSON = `${REPORT_DIR}/mutation.json`;
export const CHANGE_REPORT_MARKDOWN = `${REPORT_DIR}/change-report.md`;
export const CHANGE_REPORT_JSON = `${REPORT_DIR}/change-report.json`;

const FINISHED = [
  'Killed',
  'Survived',
  'NoCoverage',
  'Timeout',
  'CompileError',
  'RuntimeError',
  'Ignored',
] as const;
type Finished = (typeof FINISHED)[number];

type Position = { readonly line: number; readonly column: number };

type Mutant = {
  readonly status: Finished;
  readonly mutator: string;
  readonly start: Position;
  readonly end: Position;
};

export type Counts = {
  readonly killed: number;
  readonly survived: number;
  readonly noCoverage: number;
  readonly timeout: number;
  readonly errors: number;
  readonly ignored: number;
};

export type Unkilled = Position & {
  readonly mutator: string;
  readonly status: 'Survived' | 'NoCoverage';
};

export type ChangedFile = {
  readonly path: string;
  readonly kind: 'created' | 'modified';
  readonly counts: Counts;
  readonly score: number | null;
  readonly unkilled: readonly Unkilled[];
};

export type Measure = { readonly mutants: number; readonly score: number | null };

export type ChangeReport =
  | {
      readonly state: 'complete';
      readonly target: number;
      readonly change: Measure;
      readonly surface: Measure;
      readonly files: readonly ChangedFile[];
      readonly elapsedMs: number | undefined;
    }
  | {
      readonly state: 'incomplete';
      readonly reason: string;
      readonly elapsedMs: number | undefined;
    };

export type ChangeReportInput = {
  readonly report: string | undefined;
  readonly diff: string;
  readonly mutate: readonly string[];
  readonly elapsedMs: number | undefined;
};

type DiffFile = {
  readonly path: string;
  readonly created: boolean;
  readonly deleted: boolean;
  readonly lines: ReadonlySet<number>;
};

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPosition = (value: unknown): value is Position =>
  isRecord(value) && typeof value['line'] === 'number' && typeof value['column'] === 'number';

const parseMutant = (value: unknown): Mutant | 'pending' | undefined => {
  if (!isRecord(value)) return undefined;
  const { status, mutatorName, location } = value;
  if (status === 'Pending') return 'pending';
  if (!FINISHED.some((finished) => finished === status)) return undefined;
  if (typeof mutatorName !== 'string' || !isRecord(location)) return undefined;
  const { start, end } = location;
  if (!isPosition(start) || !isPosition(end)) return undefined;
  return { status: status as Finished, mutator: mutatorName, start, end };
};

const parseStrykerReport = (
  text: string | undefined,
): Parsed<ReadonlyMap<string, readonly Mutant[]>> => {
  if (text === undefined) return { ok: false, reason: 'Stryker wrote no JSON report' };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'the Stryker JSON report is not valid JSON' };
  }

  if (!isRecord(json) || !isRecord(json['files'])) {
    return { ok: false, reason: 'the Stryker JSON report has no files' };
  }

  const files = new Map<string, readonly Mutant[]>();
  for (const [name, file] of Object.entries(json['files'])) {
    if (!isRecord(file) || !Array.isArray(file['mutants'])) {
      return { ok: false, reason: `the Stryker JSON report holds no mutants for ${name}` };
    }
    const mutants: Mutant[] = [];
    for (const raw of file['mutants'] as readonly unknown[]) {
      const parsed = parseMutant(raw);
      if (parsed === 'pending') {
        return { ok: false, reason: `a mutant of ${name} was never run` };
      }
      if (parsed === undefined) {
        return { ok: false, reason: `a mutant of ${name} is not a Stryker mutant result` };
      }
      mutants.push(parsed);
    }
    files.set(name, mutants);
  }
  return { ok: true, value: files };
};

const HUNK = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const DIFF_HEADER = /^diff --git a\/.* b\/(.*)$/;

export function parseDiff(text: string): readonly DiffFile[] {
  const files: DiffFile[] = [];
  let current: { path: string; created: boolean; deleted: boolean; lines: Set<number> } | undefined;
  let oldLeft = 0;
  let newLeft = 0;

  for (const line of text.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      if (line.startsWith('-')) oldLeft -= 1;
      else if (line.startsWith('+')) newLeft -= 1;
      continue;
    }

    const header = DIFF_HEADER.exec(line);
    if (header !== null) {
      current = { path: header[1] ?? '', created: false, deleted: false, lines: new Set() };
      files.push(current);
      continue;
    }
    if (current === undefined) continue;

    if (line.startsWith('new file mode')) current.created = true;
    else if (line.startsWith('deleted file mode') || line === '+++ /dev/null') current.deleted = true;
    else if (line.startsWith('rename to ')) current.path = line.slice('rename to '.length);
    else if (line.startsWith('+++ b/')) current.path = line.slice('+++ b/'.length);
    else {
      const hunk = HUNK.exec(line);
      if (hunk === null) continue;
      oldLeft = Number(hunk[1] ?? '1');
      const start = Number(hunk[2]);
      newLeft = Number(hunk[3] ?? '1');
      for (let added = start; added < start + newLeft; added += 1) current.lines.add(added);
    }
  }
  return files;
}

export function inSurface(file: string, mutate: readonly string[]): boolean {
  const included = mutate.some(
    (pattern) => !pattern.startsWith('!') && path.posix.matchesGlob(file, pattern),
  );
  const excluded = mutate.some(
    (pattern) => pattern.startsWith('!') && path.posix.matchesGlob(file, pattern.slice(1)),
  );
  return included && !excluded;
}

const lastLine = ({ start, end }: Mutant): number =>
  end.line > start.line && end.column <= 1 ? end.line - 1 : end.line;

const overlaps = (mutant: Mutant, lines: ReadonlySet<number>): boolean => {
  for (let line = mutant.start.line; line <= lastLine(mutant); line += 1) {
    if (lines.has(line)) return true;
  }
  return false;
};

const count = (mutants: readonly Mutant[]): Counts => {
  const of = (...statuses: readonly Finished[]): number =>
    mutants.filter((mutant) => statuses.includes(mutant.status)).length;
  return {
    killed: of('Killed'),
    survived: of('Survived'),
    noCoverage: of('NoCoverage'),
    timeout: of('Timeout'),
    errors: of('CompileError', 'RuntimeError'),
    ignored: of('Ignored'),
  };
};

const scoreOf = ({ killed, timeout, survived, noCoverage }: Counts): number | null => {
  const valid = killed + timeout + survived + noCoverage;
  if (valid === 0) return null;
  return Math.round(((killed + timeout) / valid) * 10_000) / 100;
};

const measure = (mutants: readonly Mutant[]): Measure => ({
  mutants: mutants.length,
  score: scoreOf(count(mutants)),
});

const isUnkilled = (
  mutant: Mutant,
): mutant is Mutant & { readonly status: 'Survived' | 'NoCoverage' } =>
  mutant.status === 'Survived' || mutant.status === 'NoCoverage';

const byPosition = (a: Unkilled, b: Unkilled): number => a.line - b.line || a.column - b.column;

export function buildChangeReport(input: ChangeReportInput): ChangeReport {
  const { elapsedMs } = input;
  const parsed = parseStrykerReport(input.report);
  if (!parsed.ok) return { state: 'incomplete', reason: parsed.reason, elapsedMs };

  const files: ChangedFile[] = [];
  const changedMutants: Mutant[] = [];
  for (const changed of parseDiff(input.diff)) {
    if (changed.deleted || !inSurface(changed.path, input.mutate)) continue;
    const mutants = (parsed.value.get(changed.path) ?? []).filter(
      (mutant) => changed.created || overlaps(mutant, changed.lines),
    );
    if (mutants.length === 0) continue;
    changedMutants.push(...mutants);
    const counts = count(mutants);
    files.push({
      path: changed.path,
      kind: changed.created ? 'created' : 'modified',
      counts,
      score: scoreOf(counts),
      unkilled: mutants
        .filter(isUnkilled)
        .map(({ start, mutator, status }) => ({
          line: start.line,
          column: start.column,
          mutator,
          status,
        }))
        .sort(byPosition),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    state: 'complete',
    target: CHANGE_TARGET,
    change: measure(changedMutants),
    surface: measure([...parsed.value.values()].flat()),
    files,
    elapsedMs,
  };
}

const percent = (score: number): string => `${score.toFixed(2)}%`;

const formatElapsed = (ms: number | undefined): string => {
  if (ms === undefined) return 'unknown';
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes === 0 ? `${String(rest)}s` : `${String(minutes)}m ${String(rest)}s`;
};

export function renderChangeReport(report: ChangeReport): string {
  const heading = '## Change score';
  const elapsed = `Elapsed: ${formatElapsed(report.elapsedMs)}.`;

  if (report.state === 'incomplete') {
    return [
      heading,
      '',
      `**Incomplete:** ${report.reason}. There is no Change score and no whole-surface score for this run.`,
      '',
      elapsed,
      '',
    ].join('\n');
  }

  const { change, surface, target, files } = report;
  const changeLine =
    change.score === null
      ? `**Change score:** not applicable: no mutant overlaps a line this pull request adds or modifies. Target ${String(target)}%.`
      : `**Change score:** ${percent(change.score)} of ${String(change.mutants)} Changed mutants, against a target of ${String(target)}%.`;
  const surfaceLine =
    surface.score === null
      ? `**Whole-surface score:** not applicable: the surface holds no mutant.`
      : `**Whole-surface score:** ${percent(surface.score)} of ${String(surface.mutants)} mutants, the floor that fails below the break threshold.`;

  const lines = [
    heading,
    '',
    changeLine,
    '',
    surfaceLine,
    '',
    'The Change score is advisory: a low one fails nothing.',
    '',
  ];

  if (files.length > 0) {
    lines.push(
      '| File | Kind | Killed | Survived | No coverage | Timeout | Errors | Score |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...files.map(
        ({ path: file, kind, counts, score }) =>
          `| \`${file}\` | ${kind} | ${String(counts.killed)} | ${String(counts.survived)} | ${String(counts.noCoverage)} | ${String(counts.timeout)} | ${String(counts.errors)} | ${score === null ? 'n/a' : percent(score)} |`,
      ),
      '',
    );

    const unkilled = files.flatMap(({ path: file, unkilled: mutants }) =>
      mutants.map(
        ({ line, column, mutator, status }) =>
          `- \`${file}:${String(line)}:${String(column)}\` ${mutator}, ${status}`,
      ),
    );
    if (unkilled.length > 0) lines.push('### Survived and no coverage', '', ...unkilled, '');
  }

  lines.push(elapsed, '');
  return lines.join('\n');
}

if (import.meta.main) {
  const base = process.argv[2];
  if (base === undefined || base === '') {
    throw new Error('Usage: node tools/change-score.ts <base-ref>');
  }

  const found = findMergeBase(process.cwd(), base);
  if (!found.ok) throw new Error(found.problem);
  const diff = git(process.cwd(), [
    '-c',
    'core.quotePath=false',
    'diff',
    '--no-color',
    '--no-ext-diff',
    '-U0',
    '-M',
    found.mergeBase,
    found.head,
  ]);
  if (!diff.ok) throw new Error(diff.problem);
  const startedAt = Number(process.env['MUTATION_STARTED_AT']);

  const report = buildChangeReport({
    report: existsSync(STRYKER_JSON) ? readFileSync(STRYKER_JSON, 'utf8') : undefined,
    diff: diff.stdout,
    mutate: stryker.mutate,
    elapsedMs: Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt * 1000 : undefined,
  });
  const markdown = renderChangeReport(report);

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(CHANGE_REPORT_MARKDOWN, markdown);
  writeFileSync(CHANGE_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);

  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '') appendFileSync(summary, markdown);
  console.log(markdown);
}
