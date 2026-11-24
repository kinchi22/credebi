import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import stryker from '../stryker.config.ts';
import { findMergeBase, git } from './run-advisory-specs.ts';

export const CHANGE_TARGET = 95;
export const SMALL_SAMPLE = 20;

export const REPORT_DIR = 'reports/mutation';
export const STRYKER_JSON = `${REPORT_DIR}/mutation.json`;
export const CHANGE_REPORT_MARKDOWN = `${REPORT_DIR}/change-report.md`;
export const CHANGE_REPORT_JSON = `${REPORT_DIR}/change-report.json`;
export const TOLERATED_REGISTER = 'tolerated-mutants.json';

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

export type MutantIdentity = {
  readonly file: string;
  readonly mutator: string;
  readonly replacement: string;
  readonly original: string;
};

type Mutant = MutantIdentity & {
  readonly status: Finished;
  readonly start: Position;
  readonly end: Position;
};

export type ToleratedEntry = {
  readonly file: string;
  readonly mutator: string;
  readonly original: string;
  readonly replacement: string;
  readonly reason: string;
  readonly recorded: string;
  readonly revisitBy: string;
};

export type Tolerated = Position & {
  readonly mutator: string;
  readonly reason: string;
  readonly revisitBy: string;
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

type MeasurableKind = 'created' | 'modified' | 'renamed' | 'whole';

type FileChange<Kind> = {
  readonly path: string;
  readonly from?: string;
  readonly kind: Kind;
};

export type ChangedFile = FileChange<MeasurableKind> & {
  readonly counts: Counts;
  readonly score: number | null;
  readonly unkilled: readonly Unkilled[];
  readonly tolerated: readonly Tolerated[];
};

export type UnmeasuredFile = FileChange<MeasurableKind | 'deleted'> & {
  readonly reason: 'deleted' | 'excluded' | 'non-mutatable' | 'moved' | 'no-changed-mutant';
};

export type Measure = {
  readonly mutants: number;
  readonly score: number | null;
  readonly counts: Counts;
};

export type ChangeReport =
  | {
      readonly state: 'complete';
      readonly target: number;
      readonly change: Measure;
      readonly scope: ChangeScope;
      readonly measuresSurface: boolean;
      readonly surface?: Measure;
      readonly smallSample: boolean;
      readonly untriaged: number;
      readonly files: readonly ChangedFile[];
      readonly unmeasured: readonly UnmeasuredFile[];
      readonly elapsedMs: number | undefined;
    }
  | {
      readonly state: 'invalid';
      readonly scope: ChangeScope;
      readonly measuresSurface: boolean;
      readonly reason: string;
      readonly elapsedMs: number | undefined;
    }
  | {
      readonly state: 'incomplete';
      readonly scope: ChangeScope;
      readonly measuresSurface: boolean;
      readonly reason: string;
      readonly elapsedMs: number | undefined;
    };

export type ChangeScope = 'change' | 'file';

export type ChangeReportInput = {
  readonly scope?: ChangeScope;
  readonly measureSurface?: boolean;
  readonly report: string | undefined;
  readonly register: string | undefined;
  readonly diff: string;
  readonly mutate: readonly string[];
  readonly elapsedMs: number | undefined;
};

type DiffFile = {
  readonly path: string;
  readonly from: string | undefined;
  readonly created: boolean;
  readonly deleted: boolean;
  readonly lines: ReadonlySet<number>;
};

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPosition = (value: unknown): value is Position =>
  isRecord(value) && typeof value['line'] === 'number' && typeof value['column'] === 'number';

const textAt = (source: string, start: Position, end: Position): string => {
  const lines = source.split('\n');
  const offsetOf = ({ line, column }: Position): number =>
    lines.slice(0, line - 1).reduce((total, text) => total + text.length + 1, 0) + column - 1;
  return source.slice(offsetOf(start), offsetOf(end));
};

const parseMutant = (value: unknown, file: string, source: string): Mutant | 'pending' | undefined => {
  if (!isRecord(value)) return undefined;
  const { status, mutatorName, location, replacement } = value;
  if (status === 'Pending') return 'pending';
  if (!FINISHED.some((finished) => finished === status)) return undefined;
  if (typeof mutatorName !== 'string' || typeof replacement !== 'string') return undefined;
  if (!isRecord(location)) return undefined;
  const { start, end } = location;
  if (!isPosition(start) || !isPosition(end)) return undefined;
  return {
    status: status as Finished,
    file,
    mutator: mutatorName,
    replacement,
    original: textAt(source, start, end),
    start,
    end,
  };
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
    const source = file['source'];
    if (typeof source !== 'string') {
      return { ok: false, reason: `the Stryker JSON report holds no source for ${name}` };
    }
    for (const raw of file['mutants'] as readonly unknown[]) {
      const parsed = parseMutant(raw, name, source);
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

const ENTRY_FIELDS = [
  'file',
  'mutator',
  'original',
  'replacement',
  'reason',
  'recorded',
  'revisitBy',
] as const;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const daysIn = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

const parseDay = (text: string): { year: number; month: number; day: number } | undefined => {
  const match = DAY.exec(text);
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return undefined;
  return { year, month, day };
};

const sixMonthsAfter = (recorded: string): string => {
  const { year, month, day } = parseDay(recorded) ?? { year: 0, month: 1, day: 1 };
  const index = year * 12 + (month - 1) + 6;
  const lateYear = Math.floor(index / 12);
  const lateMonth = (index % 12) + 1;
  const lateDay = Math.min(day, daysIn(lateYear, lateMonth));
  return [lateYear, lateMonth, lateDay].map((part, at) => String(part).padStart(at === 0 ? 4 : 2, '0')).join('-');
};

const checkEntry = (value: unknown, position: number): string | undefined => {
  const where = `entry ${String(position)} of the register`;
  if (!isRecord(value)) return `${where} is not an object`;
  for (const field of ENTRY_FIELDS) {
    if (typeof value[field] !== 'string') return `${where} has no string \`${field}\``;
  }
  const extra = Object.keys(value).find((key) => !ENTRY_FIELDS.some((field) => field === key));
  if (extra !== undefined) return `${where} has an unknown field \`${extra}\``;

  const entry = value as ToleratedEntry;
  if (entry.original === '') return `${where} has an empty \`original\``;
  if (entry.reason.trim() === '') return `${where} has an empty \`reason\``;
  for (const field of ['recorded', 'revisitBy'] as const) {
    if (parseDay(entry[field]) === undefined) {
      return `${where} has a \`${field}\` that is not a YYYY-MM-DD date`;
    }
  }
  if (entry.revisitBy < entry.recorded) return `${where} has a \`revisitBy\` before its \`recorded\``;
  if (entry.revisitBy > sixMonthsAfter(entry.recorded)) {
    return `${where} has a \`revisitBy\` more than six months after its \`recorded\``;
  }
  return undefined;
};

const parseRegister = (text: string | undefined): Parsed<readonly ToleratedEntry[]> => {
  if (text === undefined) return { ok: false, reason: `the register ${TOLERATED_REGISTER} is missing` };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: `the register ${TOLERATED_REGISTER} is not valid JSON` };
  }
  if (!Array.isArray(json)) {
    return { ok: false, reason: `the register ${TOLERATED_REGISTER} is not an array of entries` };
  }
  const entries = json as readonly unknown[];
  for (const [index, entry] of entries.entries()) {
    const problem = checkEntry(entry, index + 1);
    if (problem !== undefined) return { ok: false, reason: problem };
  }
  return { ok: true, value: entries as readonly ToleratedEntry[] };
};

export const matchesEntry = (entry: ToleratedEntry, mutant: MutantIdentity): boolean =>
  entry.file === mutant.file &&
  entry.mutator === mutant.mutator &&
  entry.replacement === mutant.replacement &&
  entry.original === mutant.original;

const toleratingEntries = (
  entries: readonly ToleratedEntry[],
  mutants: readonly Mutant[],
): Parsed<ReadonlyMap<Mutant, ToleratedEntry>> => {
  for (const mutant of mutants) {
    if (entries.filter((entry) => matchesEntry(entry, mutant)).length > 1) {
      return {
        ok: false,
        reason: `two entries of the register match the same mutant: ${mutant.mutator} of \`${mutant.file}\` replacing \`${mutant.original}\` with \`${mutant.replacement}\``,
      };
    }
  }
  const tolerated = new Map<Mutant, ToleratedEntry>();
  for (const entry of entries) {
    const matched = mutants.filter((mutant) => matchesEntry(entry, mutant));
    const [only] = matched;
    if (matched.length === 1 && only?.status === 'Survived') tolerated.set(only, entry);
  }
  return { ok: true, value: tolerated };
};

export const DIFF_ARGUMENTS = [
  '-c',
  'core.quotePath=false',
  'diff',
  '--no-color',
  '--no-ext-diff',
  '-U0',
  '-M',
] as const;

const HUNK = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const DIFF_HEADER = /^diff --git a\/.* b\/(.*)$/;

export function parseDiff(text: string): readonly DiffFile[] {
  const files: DiffFile[] = [];
  let current:
    | { path: string; from: string | undefined; created: boolean; deleted: boolean; lines: Set<number> }
    | undefined;
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
      current = {
        path: header[1] ?? '',
        from: undefined,
        created: false,
        deleted: false,
        lines: new Set(),
      };
      files.push(current);
      continue;
    }
    if (current === undefined) continue;

    if (line.startsWith('new file mode')) current.created = true;
    else if (line.startsWith('deleted file mode') || line === '+++ /dev/null') current.deleted = true;
    else if (line.startsWith('rename from ')) current.from = line.slice('rename from '.length);
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

const scoredOf = ({ killed, timeout, survived, noCoverage }: Counts): number =>
  killed + timeout + survived + noCoverage;

const scoreOf = (counts: Counts): number | null => {
  const scored = scoredOf(counts);
  if (scored === 0) return null;
  return Math.round(((counts.killed + counts.timeout) / scored) * 10_000) / 100;
};

const measure = (mutants: readonly Mutant[]): Measure => {
  const counts = count(mutants);
  return { mutants: mutants.length, score: scoreOf(counts), counts };
};

const measurableKindOf = (changed: DiffFile): MeasurableKind => {
  if (changed.created) return 'created';
  return changed.from === undefined ? 'modified' : 'renamed';
};

const isOnlyMoved = (changed: DiffFile): boolean =>
  changed.from !== undefined && changed.lines.size === 0;

const unmeasuredReason = (
  changed: DiffFile,
  mutants: readonly Mutant[],
  mutate: readonly string[],
  reported: boolean,
): UnmeasuredFile['reason'] | undefined => {
  if (changed.deleted) return 'deleted';
  if (!inSurface(changed.path, mutate)) return 'excluded';
  if (!reported && isOnlyMoved(changed)) return 'moved';
  if (mutants.length === 0) return 'non-mutatable';
  if (isOnlyMoved(changed)) return 'moved';
  return undefined;
};

const isUnkilled = (
  mutant: Mutant,
): mutant is Mutant & { readonly status: 'Survived' | 'NoCoverage' } =>
  mutant.status === 'Survived' || mutant.status === 'NoCoverage';

const byPosition = (a: Position, b: Position): number => a.line - b.line || a.column - b.column;

export function buildChangeReport(input: ChangeReportInput): ChangeReport {
  const { elapsedMs } = input;
  const scope = input.scope ?? 'change';
  const measuresSurface = input.measureSurface !== false;
  const parsed = parseStrykerReport(input.report);
  if (!parsed.ok) {
    return { state: 'incomplete', scope, measuresSurface, reason: parsed.reason, elapsedMs };
  }

  const register = parseRegister(input.register);
  if (!register.ok) {
    return { state: 'invalid', scope, measuresSurface, reason: register.reason, elapsedMs };
  }
  const tolerating = toleratingEntries(register.value, [...parsed.value.values()].flat());
  if (!tolerating.ok) {
    return { state: 'invalid', scope, measuresSurface, reason: tolerating.reason, elapsedMs };
  }

  const files: ChangedFile[] = [];
  const unmeasured: UnmeasuredFile[] = [];
  const changedMutants: Mutant[] = [];
  for (const changed of parseDiff(input.diff)) {
    const kind = input.scope === 'file' ? 'whole' : measurableKindOf(changed);
    const from = changed.from === undefined ? {} : { from: changed.from };
    const all = parsed.value.get(changed.path) ?? [];
    const reason = unmeasuredReason(changed, all, input.mutate, parsed.value.has(changed.path));
    const mutants = all.filter((mutant) => changed.created || overlaps(mutant, changed.lines));
    if (reason !== undefined || mutants.length === 0) {
      unmeasured.push({
        path: changed.path,
        ...from,
        kind: changed.deleted ? 'deleted' : kind,
        reason: reason ?? 'no-changed-mutant',
      });
      continue;
    }
    changedMutants.push(...mutants);
    const counts = count(mutants);
    files.push({
      path: changed.path,
      ...from,
      kind,
      counts,
      score: scoreOf(counts),
      unkilled: mutants
        .filter(isUnkilled)
        .filter((mutant) => !tolerating.value.has(mutant))
        .map(({ start, mutator, status }) => ({
          line: start.line,
          column: start.column,
          mutator,
          status,
        }))
        .sort(byPosition),
      tolerated: mutants
        .flatMap((mutant) => {
          const entry = tolerating.value.get(mutant);
          return entry === undefined
            ? []
            : [
                {
                  line: mutant.start.line,
                  column: mutant.start.column,
                  mutator: mutant.mutator,
                  reason: entry.reason,
                  revisitBy: entry.revisitBy,
                },
              ];
        })
        .sort(byPosition),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  unmeasured.sort((a, b) => a.path.localeCompare(b.path));

  const change = measure(changedMutants);
  return {
    state: 'complete',
    target: CHANGE_TARGET,
    change,
    scope,
    measuresSurface,
    ...(measuresSurface ? { surface: measure([...parsed.value.values()].flat()) } : {}),
    smallSample: change.mutants > 0 && scoredOf(change.counts) < SMALL_SAMPLE,
    untriaged: files.reduce((total, file) => total + file.unkilled.length, 0),
    files,
    unmeasured,
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

const WHY_NOT_MEASURED: Record<UnmeasuredFile['reason'], string> = {
  deleted: 'contributes nothing',
  excluded: 'excluded, outside the `mutate` patterns',
  'non-mutatable': 'non-mutatable, inside the `mutate` patterns with no mutant',
  moved: 'moved with no edited line',
  'no-changed-mutant': 'no Changed mutant, no mutant on an edited line',
};

const describeKind = ({ kind, from }: UnmeasuredFile): string =>
  from === undefined ? kind : `${kind} from \`${from}\``;

const rawCounts = ({ killed, timeout, survived, noCoverage, errors, ignored }: Counts): string =>
  [
    `${String(killed)} killed`,
    `${String(timeout)} timeout`,
    `${String(survived)} survived`,
    `${String(noCoverage)} no coverage`,
    `${String(errors)} ${errors === 1 ? 'error' : 'errors'}`,
    `${String(ignored)} ignored`,
  ].join(', ');

const remaining = (unkilled: number): string => {
  if (unkilled === 0) return 'none remain';
  return unkilled === 1 ? '1 remains' : `${String(unkilled)} remain`;
};

const SCORE_NAME: Record<ChangeScope, string> = { change: 'Change score', file: 'File score' };

const changeScoreLine = (report: Extract<ChangeReport, { state: 'complete' }>): string => {
  const { change, target, smallSample, scope, measuresSurface, untriaged } = report;
  const name = SCORE_NAME[scope];
  const mutants = scope === 'file' ? 'mutants' : 'Changed mutants';
  if (change.mutants === 0) {
    const why =
      scope === 'file'
        ? 'the named files hold no mutant'
        : `no mutant overlaps a line this ${measuresSurface ? 'pull request' : 'change'} adds or modifies`;
    return `**${name}:** N/A: ${why}. Target ${String(target)}%.`;
  }
  if (smallSample || change.score === null) {
    return `**${name}:** ${String(scoredOf(change.counts))} scored of ${String(change.mutants)} ${mutants}, fewer than ${String(SMALL_SAMPLE)} scored: ${rawCounts(change.counts)}. The target is zero untriaged survived or no-coverage mutants, and ${remaining(untriaged)}.`;
  }
  return `**${name}:** ${percent(change.score)} of ${String(change.mutants)} ${mutants}, against a target of ${String(target)}%.`;
};

export function renderChangeReport(report: ChangeReport): string {
  const name = SCORE_NAME[report.scope];
  const heading = `## ${name}`;
  const elapsed = `Elapsed: ${formatElapsed(report.elapsedMs)}.`;

  if (report.state === 'invalid') {
    return [
      heading,
      '',
      `**Invalid:** ${report.reason}. There is no ${name}${report.measuresSurface ? ' and no whole-surface score' : ''} for this run, and the step fails.`,
      '',
      elapsed,
      '',
    ].join('\n');
  }

  if (report.state === 'incomplete') {
    return [
      heading,
      '',
      `**Incomplete:** ${report.reason}. There is no ${name}${report.measuresSurface ? ' and no whole-surface score' : ''} for this run.`,
      '',
      elapsed,
      '',
    ].join('\n');
  }

  const { surface, files, unmeasured } = report;
  const changeLine = changeScoreLine(report);
  const surfaceLine = (measured: Measure): string =>
    measured.score === null
      ? `**Whole-surface score:** not applicable: the surface holds no mutant.`
      : `**Whole-surface score:** ${percent(measured.score)} of ${String(measured.mutants)} mutants, the floor that fails below the break threshold.`;

  const lines = [
    heading,
    '',
    changeLine,
    '',
    ...(report.measuresSurface && surface !== undefined ? [surfaceLine(surface), ''] : []),
    `The ${name} is advisory: a low one fails nothing.`,
    '',
  ];

  if (files.length > 0) {
    lines.push(
      '| File | Kind | Killed | Survived | No coverage | Timeout | Errors | Ignored | Score |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...files.map(
        ({ path: file, kind, counts, score }) =>
          `| \`${file}\` | ${kind} | ${String(counts.killed)} | ${String(counts.survived)} | ${String(counts.noCoverage)} | ${String(counts.timeout)} | ${String(counts.errors)} | ${String(counts.ignored)} | ${score === null ? 'n/a' : percent(score)} |`,
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

    const tolerated = files.flatMap(({ path: file, tolerated: mutants }) =>
      mutants.map(
        ({ line, column, mutator, reason, revisitBy }) =>
          `- \`${file}:${String(line)}:${String(column)}\` ${mutator}, tolerated: ${reason} Revisit by ${revisitBy}.`,
      ),
    );
    if (tolerated.length > 0) lines.push('### Tolerated', '', ...tolerated, '');
  }

  if (unmeasured.length > 0) {
    lines.push(
      '### Not measured',
      '',
      ...unmeasured.map(
        (file) => `- \`${file.path}\`, ${describeKind(file)}: ${WHY_NOT_MEASURED[file.reason]}`,
      ),
      '',
    );
  }

  lines.push(elapsed, '');
  return lines.join('\n');
}

export const LOCAL_BASE = 'origin/main';
export const LOCAL_REPORT_DIR = 'reports/mutation-changed';
export const LOCAL_STRYKER_JSON = `${LOCAL_REPORT_DIR}/mutation.json`;
export const LOCAL_CHANGE_REPORT_MARKDOWN = `${LOCAL_REPORT_DIR}/change-report.md`;
export const LOCAL_CHANGE_REPORT_JSON = `${LOCAL_REPORT_DIR}/change-report.json`;

export type LocalArguments =
  | { readonly ok: true; readonly mode: 'change'; readonly base: string }
  | { readonly ok: true; readonly mode: 'file'; readonly files: readonly string[] }
  | { readonly ok: false; readonly problem: string };

const flagValue = (args: readonly string[], index: number): string | undefined => {
  const value = args[index + 1];
  return value === undefined || value === '' || value.startsWith('-') ? undefined : value;
};

export function parseLocalArguments(args: readonly string[]): LocalArguments {
  let base: string | undefined;
  const files: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg !== '--base' && arg !== '--file') return { ok: false, problem: `unknown argument ${arg}` };
    const value = flagValue(args, index);
    if (value === undefined) {
      return { ok: false, problem: arg === '--base' ? '--base needs a ref' : '--file needs a path' };
    }
    if (arg === '--base') base = value;
    else files.push(value);
    index += 1;
  }
  if (files.length === 0) return { ok: true, mode: 'change', base: base ?? LOCAL_BASE };
  if (base !== undefined) {
    return { ok: false, problem: '--file measures named files whole and cannot be combined with --base' };
  }
  return { ok: true, mode: 'file', files };
}

export type LocalPlan =
  | { readonly kind: 'error'; readonly problem: string }
  | { readonly kind: 'none'; readonly scope: ChangeScope; readonly diff: string }
  | {
      readonly kind: 'run';
      readonly scope: ChangeScope;
      readonly diff: string;
      readonly mutate: readonly string[];
    };

export type DiffReader = (
  base: string,
) => { readonly ok: true; readonly diff: string } | { readonly ok: false; readonly problem: string };

const createdDiff = (file: string): string =>
  [
    `diff --git a/${file} b/${file}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${file}`,
    '@@ -0,0 +1 @@',
    '+',
  ].join('\n');

function planFiles(input: {
  readonly files: readonly string[];
  readonly mutate: readonly string[];
  readonly exists: (file: string) => boolean;
}): LocalPlan {
  const named = [...new Set(input.files.map((file) => path.posix.normalize(file)))].sort((a, b) =>
    a.localeCompare(b),
  );
  const refusals = named.flatMap((file) => {
    if (!input.exists(file)) return [`${file} does not exist`];
    if (!inSurface(file, input.mutate)) return [`${file} is outside the mutate patterns`];
    return [];
  });
  if (refusals.length > 0) return { kind: 'error', problem: refusals.join('; ') };
  return { kind: 'run', scope: 'file', diff: named.map(createdDiff).join('\n'), mutate: named };
}

export function planLocalRun(input: {
  readonly args: readonly string[];
  readonly mutate: readonly string[];
  readonly readDiff: DiffReader;
  readonly exists: (file: string) => boolean;
}): LocalPlan {
  const args = parseLocalArguments(input.args);
  if (!args.ok) return { kind: 'error', problem: args.problem };
  if (args.mode === 'file') {
    return planFiles({ files: args.files, mutate: input.mutate, exists: input.exists });
  }
  const read = input.readDiff(args.base);
  if (!read.ok) return { kind: 'error', problem: read.problem };

  const mutate = parseDiff(read.diff)
    .filter((file) => !file.deleted && !isOnlyMoved(file) && inSurface(file.path, input.mutate))
    .map((file) => file.path)
    .sort((a, b) => a.localeCompare(b));
  return mutate.length === 0
    ? { kind: 'none', scope: 'change', diff: read.diff }
    : { kind: 'run', scope: 'change', diff: read.diff, mutate };
}

if (import.meta.main) {
  const base = process.argv[2];
  if (base === undefined || base === '') {
    throw new Error('Usage: node tools/change-score.ts <base-ref>');
  }

  const found = findMergeBase(process.cwd(), base);
  if (!found.ok) throw new Error(found.problem);
  const diff = git(process.cwd(), [
    ...DIFF_ARGUMENTS,
    found.mergeBase,
    found.head,
  ]);
  if (!diff.ok) throw new Error(diff.problem);
  const startedAt = Number(process.env['MUTATION_STARTED_AT']);

  const report = buildChangeReport({
    report: existsSync(STRYKER_JSON) ? readFileSync(STRYKER_JSON, 'utf8') : undefined,
    register: existsSync(TOLERATED_REGISTER) ? readFileSync(TOLERATED_REGISTER, 'utf8') : undefined,
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
  if (report.state === 'invalid') process.exitCode = 1;
}
