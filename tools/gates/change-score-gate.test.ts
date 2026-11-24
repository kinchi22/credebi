import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import stryker from '../../stryker.config';
import { REPO_ROOT } from './run-gate';
import {
  buildChangeReport,
  parseLocalArguments,
  planLocalRun,
  type DiffReader,
  renderChangeReport,
  TOLERATED_REGISTER,
  type ChangeReport,
} from '../change-score';

type Status =
  | 'Killed'
  | 'Survived'
  | 'NoCoverage'
  | 'Timeout'
  | 'CompileError'
  | 'RuntimeError'
  | 'Ignored'
  | 'Pending';

type Mutant = {
  readonly status: Status;
  readonly line: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly mutator?: string;
  readonly original?: string;
  readonly replacement?: string;
};

const MUTATE = stryker.mutate;
const NO_TOLERANCE = { register: '[]' };

const mutant = (status: Status, line: number, rest: Partial<Mutant> = {}): Mutant => ({
  status,
  line,
  ...rest,
});

const many = (count: number, status: Status, line = 1): readonly Mutant[] =>
  Array.from({ length: count }, () => mutant(status, line));

const sourceOf = (mutants: readonly Mutant[]): string => {
  const lines: string[] = [];
  for (const m of mutants) {
    if (m.original === undefined) continue;
    while (lines.length < m.line) lines.push('');
    lines[m.line - 1] = `  ${m.original}`;
  }
  return lines.join('\n');
};

const strykerReport = (files: Record<string, readonly Mutant[]>): string =>
  JSON.stringify({
    schemaVersion: '1.0',
    thresholds: { high: 95, low: 90, break: 90 },
    files: Object.fromEntries(
      Object.entries(files).map(([name, mutants]) => [
        name,
        {
          language: 'typescript',
          source: sourceOf(mutants),
          mutants: mutants.map((m, index) => ({
            id: `${name}#${String(index)}`,
            mutatorName: m.mutator ?? 'ConditionalExpression',
            replacement: m.replacement ?? 'true',
            status: m.status,
            location: {
              start: { line: m.line, column: 3 },
              end: {
                line: m.endLine ?? m.line,
                column: m.endColumn ?? (m.original === undefined ? 9 : 3 + m.original.length),
              },
            },
          })),
        },
      ]),
    ),
  });

const created = (file: string, lines: number): string =>
  [
    `diff --git a/${file} b/${file}`,
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    `+++ b/${file}`,
    `@@ -0,0 +1,${String(lines)} @@`,
    ...Array.from({ length: lines }, (_, i) => `+line ${String(i + 1)}`),
  ].join('\n');

type Hunk = readonly [start: number, count: number];

const edits = (from: string, to: string, hunks: readonly Hunk[]): readonly string[] => [
  'index 1111111..2222222 100644',
  `--- a/${from}`,
  `+++ b/${to}`,
  ...hunks.flatMap(([start, count]) => [
    `@@ -${String(start)},${String(count)} +${String(start)},${String(count)} @@`,
    ...Array.from({ length: count }, () => '-old'),
    ...Array.from({ length: count }, () => '+new'),
  ]),
];

const modified = (file: string, ...hunks: readonly Hunk[]): string =>
  [`diff --git a/${file} b/${file}`, ...edits(file, file, hunks)].join('\n');

const renamed = (from: string, to: string, ...hunks: readonly Hunk[]): string =>
  [
    `diff --git a/${from} b/${to}`,
    `similarity index ${hunks.length === 0 ? '100' : '90'}%`,
    `rename from ${from}`,
    `rename to ${to}`,
    ...(hunks.length === 0 ? [] : edits(from, to, hunks)),
  ].join('\n');

const deleted = (file: string, lines: number): string =>
  [
    `diff --git a/${file} b/${file}`,
    'deleted file mode 100644',
    'index 1111111..0000000',
    `--- a/${file}`,
    '+++ /dev/null',
    `@@ -1,${String(lines)} +0,0 @@`,
    ...Array.from({ length: lines }, (_, i) => `-line ${String(i + 1)}`),
  ].join('\n');

const complete = (report: ChangeReport): Extract<ChangeReport, { state: 'complete' }> => {
  if (report.state !== 'complete') throw new Error(`expected a complete report, got ${report.reason}`);
  return report;
};

const build = (
  files: Record<string, readonly Mutant[]>,
  diff: string,
): Extract<ChangeReport, { state: 'complete' }> =>
  complete(buildChangeReport({ ...NO_TOLERANCE, report: strykerReport(files), diff, mutate: MUTATE, elapsedMs: 1 }));

const changeScoreLine = (report: ChangeReport): string | undefined =>
  renderChangeReport(report)
    .split('\n')
    .find((line) => line.startsWith('**Change score:**'));

const OLD = 'packages/core/src/ledger/domain/entry.ts';
const NEW = 'packages/core/src/ledger/domain/balance.ts';
const MOVED = 'packages/core/src/ledger/domain/posting.ts';
const ROUTER = 'apps/web/server/routers/ledger.ts';
const TYPES = 'packages/contracts/src/ledger-types.ts';

describe('the Change score', () => {
  it('scores a new file whose tests kill nothing low while the whole surface stays above the floor', () => {
    const report = build(
      { [OLD]: many(200, 'Killed'), [NEW]: many(10, 'Survived', 2) },
      created(NEW, 4),
    );

    expect(report.change).toMatchObject({ mutants: 10, score: 0 });
    expect(report.surface?.score).toBeGreaterThanOrEqual(90);
    expect(report.surface?.mutants).toBe(210);
  });

  it('counts every mutant of a file the pull request creates, beyond the lines of its hunks', () => {
    const report = build({ [NEW]: [mutant('Killed', 1), mutant('Survived', 40)] }, created(NEW, 2));

    expect(report.change).toMatchObject({ mutants: 2, score: 50 });
  });

  it('counts only the mutants that overlap an added or modified line of a modified file', () => {
    const report = build(
      {
        [OLD]: [
          mutant('Killed', 4),
          mutant('Survived', 10),
          mutant('Survived', 11),
          mutant('NoCoverage', 30),
        ],
      },
      modified(OLD, [10, 2]),
    );

    expect(report.change).toMatchObject({ mutants: 2, score: 0 });
    expect(report.files.map((file) => file.counts.survived)).toEqual([2]);
  });

  it('counts a mutant on the first and on the last line of a hunk, and not on the line after it', () => {
    const report = build(
      {
        [OLD]: [
          mutant('Killed', 9),
          mutant('Killed', 10),
          mutant('Survived', 12),
          mutant('Killed', 13),
        ],
      },
      modified(OLD, [10, 3]),
    );

    expect(report.change).toMatchObject({ mutants: 2, score: 50 });
  });

  it('counts a mutant that starts before a hunk and ends inside it', () => {
    const report = build(
      { [OLD]: [mutant('Survived', 5, { endLine: 10 }), mutant('Killed', 5, { endLine: 9 })] },
      modified(OLD, [10, 1]),
    );

    expect(report.change).toMatchObject({ mutants: 1, score: 0 });
  });

  it('does not count a mutant whose exclusive end falls at the first column of a hunk', () => {
    const report = build(
      { [OLD]: [mutant('Survived', 5, { endLine: 10, endColumn: 1 })] },
      modified(OLD, [10, 1]),
    );

    expect(report.change).toMatchObject({ mutants: 0, score: null });
  });

  it('counts no line for a hunk that only deletes', () => {
    const diff = [
      `diff --git a/${OLD} b/${OLD}`,
      'index 1111111..2222222 100644',
      `--- a/${OLD}`,
      `+++ b/${OLD}`,
      '@@ -10,2 +9,0 @@',
      '-gone',
      '-gone',
    ].join('\n');

    const report = build({ [OLD]: [mutant('Survived', 9), mutant('Survived', 10)] }, diff);

    expect(report.change).toMatchObject({ mutants: 0, score: null });
  });

  it('reads a hunk header that omits its count as one line', () => {
    const diff = [
      `diff --git a/${OLD} b/${OLD}`,
      `--- a/${OLD}`,
      `+++ b/${OLD}`,
      '@@ -7 +7 @@',
      '-old',
      '+new',
    ].join('\n');

    const report = build({ [OLD]: [mutant('Killed', 7), mutant('Survived', 8)] }, diff);

    expect(report.change).toMatchObject({ mutants: 1, score: 100 });
  });

  it('counts the way Stryker does: timeouts as detected, errors and ignored outside the denominator', () => {
    const report = build(
      {
        [NEW]: [
          mutant('Killed', 1),
          mutant('Timeout', 1),
          mutant('Survived', 1),
          mutant('NoCoverage', 1),
          mutant('CompileError', 1),
          mutant('RuntimeError', 1),
          mutant('Ignored', 1),
        ],
      },
      created(NEW, 1),
    );

    expect(report.change).toMatchObject({ mutants: 7, score: 50 });
    expect(report.files[0]?.counts).toEqual({
      killed: 1,
      survived: 1,
      noCoverage: 1,
      timeout: 1,
      errors: 2,
      ignored: 1,
    });
  });

  it('is not applicable, never 100, when no mutant overlaps the change', () => {
    const report = build({ [OLD]: many(3, 'Killed', 50) }, modified(OLD, [1, 1]));

    expect(report.change).toMatchObject({ mutants: 0, score: null });
    expect(changeScoreLine(report)).toMatch(/^\*\*Change score:\*\* N\/A: /);
    expect(changeScoreLine(report)).not.toContain('100');
  });

  it('counts no file outside the mutate patterns, even when the report holds it', () => {
    const report = build({ [ROUTER]: many(2, 'Survived') }, created(ROUTER, 3));

    expect(report.change).toMatchObject({ mutants: 0, score: null });
    expect(report.files).toEqual([]);
  });

  it('counts the errors and ignored mutants of the change apart from its score', () => {
    const report = build(
      {
        [NEW]: [
          mutant('Killed', 1),
          mutant('CompileError', 1),
          mutant('RuntimeError', 1),
          mutant('Ignored', 1),
        ],
      },
      created(NEW, 1),
    );

    expect(report.change).toEqual({
      mutants: 4,
      score: 100,
      counts: { killed: 1, survived: 0, noCoverage: 0, timeout: 0, errors: 2, ignored: 1 },
    });
  });

  it('lists each changed file with its unkilled mutants, location and mutator', () => {
    const report = build(
      {
        [NEW]: [
          mutant('Killed', 1),
          mutant('NoCoverage', 3, { mutator: 'StringLiteral' }),
          mutant('Survived', 2, { mutator: 'EqualityOperator' }),
        ],
        [OLD]: [mutant('Survived', 4, { mutator: 'BlockStatement' })],
      },
      [modified(OLD, [4, 1]), created(NEW, 3)].join('\n'),
    );

    expect(report.files).toEqual([
      {
        path: NEW,
        kind: 'created',
        counts: { killed: 1, survived: 1, noCoverage: 1, timeout: 0, errors: 0, ignored: 0 },
        score: 33.33,
        unkilled: [
          { line: 2, column: 3, mutator: 'EqualityOperator', status: 'Survived' },
          { line: 3, column: 3, mutator: 'StringLiteral', status: 'NoCoverage' },
        ],
        tolerated: [],
      },
      {
        path: OLD,
        kind: 'modified',
        counts: { killed: 0, survived: 1, noCoverage: 0, timeout: 0, errors: 0, ignored: 0 },
        score: 0,
        unkilled: [{ line: 4, column: 3, mutator: 'BlockStatement', status: 'Survived' }],
        tolerated: [],
      },
    ]);
  });
});

describe('every changed file', () => {
  it('counts nothing of a file only renamed, and lists it as moved', () => {
    const report = build({ [MOVED]: many(3, 'Survived', 2) }, renamed(OLD, MOVED));

    expect(report.change).toMatchObject({ mutants: 0, score: null });
    expect(report.files).toEqual([]);
    expect(report.unmeasured).toEqual([{ path: MOVED, from: OLD, kind: 'renamed', reason: 'moved' }]);
  });

  it('counts only the edited lines of a file renamed with edits', () => {
    const report = build(
      { [MOVED]: [mutant('Survived', 2), mutant('Killed', 7), mutant('Survived', 30)] },
      renamed(OLD, MOVED, [7, 1]),
    );

    expect(report.change).toMatchObject({ mutants: 1, score: 100 });
    expect(report.files).toMatchObject([{ path: MOVED, from: OLD, kind: 'renamed' }]);
    expect(report.unmeasured).toEqual([]);
  });

  it('counts nothing of a deleted file, and lists it as deleted', () => {
    const report = build({ [OLD]: many(2, 'Survived') }, deleted(OLD, 4));

    expect(report.change).toMatchObject({ mutants: 0, score: null });
    expect(report.unmeasured).toEqual([{ path: OLD, kind: 'deleted', reason: 'deleted' }]);
  });

  it('lists a file outside the mutate patterns as excluded', () => {
    const report = build({ [OLD]: many(2, 'Killed') }, modified(ROUTER, [3, 1]));

    expect(report.unmeasured).toEqual([{ path: ROUTER, kind: 'modified', reason: 'excluded' }]);
  });

  it('lists a file inside the mutate patterns whose report entry holds no mutant as non-mutatable', () => {
    const report = build({ [TYPES]: [], [OLD]: many(2, 'Killed') }, created(TYPES, 5));

    expect(report.change).toMatchObject({ mutants: 0, score: null });
    expect(report.unmeasured).toEqual([{ path: TYPES, kind: 'created', reason: 'non-mutatable' }]);
  });

  it('lists a file inside the mutate patterns that the report omits as non-mutatable', () => {
    const report = build({ [OLD]: many(2, 'Killed') }, modified(TYPES, [1, 1]));

    expect(report.unmeasured).toEqual([{ path: TYPES, kind: 'modified', reason: 'non-mutatable' }]);
  });

  it('lists a modified file whose edited lines hold no mutant apart from the measured ones', () => {
    const report = build({ [OLD]: many(2, 'Killed', 50) }, modified(OLD, [1, 1]));

    expect(report.files).toEqual([]);
    expect(report.unmeasured).toEqual([{ path: OLD, kind: 'modified', reason: 'no-changed-mutant' }]);
  });

  it('classifies every file of one diff, measured or not, each in path order', () => {
    const report = build(
      { [NEW]: many(2, 'Killed'), [OLD]: many(1, 'Killed'), [MOVED]: many(1, 'Killed') },
      [
        created(NEW, 2),
        modified(ROUTER, [1, 1]),
        created(TYPES, 3),
        deleted(OLD, 1),
        renamed('packages/core/src/ledger/domain/old-posting.ts', MOVED),
      ].join('\n'),
    );

    expect(report.files.map(({ path: file }) => file)).toEqual([NEW]);
    expect(report.unmeasured.map(({ path: file, reason }) => [file, reason])).toEqual([
      [ROUTER, 'excluded'],
      [TYPES, 'non-mutatable'],
      [OLD, 'deleted'],
      [MOVED, 'moved'],
    ]);
  });
});

describe('a small change', () => {
  it('is a small sample below 20 scored Changed mutants', () => {
    expect(build({ [NEW]: many(19, 'Killed') }, created(NEW, 1)).smallSample).toBe(true);
  });

  it('is no small sample at 20 scored Changed mutants', () => {
    expect(
      build({ [NEW]: [...many(10, 'Timeout'), ...many(5, 'Survived'), ...many(5, 'NoCoverage')] }, created(NEW, 1))
        .smallSample,
    ).toBe(false);
  });

  it('is a small sample when errors and ignored mutants take the Changed mutants past 20 but the scored stay below', () => {
    const report = build(
      { [NEW]: [...many(19, 'Killed'), ...many(2, 'CompileError'), ...many(2, 'Ignored')] },
      created(NEW, 1),
    );

    expect(report.change.mutants).toBe(23);
    expect(report.smallSample).toBe(true);
  });

  it('is no small sample with no Changed mutant, being not applicable', () => {
    expect(build({ [OLD]: many(2, 'Killed', 50) }, modified(OLD, [1, 1])).smallSample).toBe(false);
  });

  it('shows raw counts, never N/A, when every Changed mutant is an error or ignored', () => {
    const report = build(
      { [NEW]: [mutant('RuntimeError', 1), mutant('Ignored', 1)] },
      created(NEW, 1),
    );

    expect(report.smallSample).toBe(true);
    expect(changeScoreLine(report)).toBe(
      '**Change score:** 0 scored of 2 Changed mutants, fewer than 20 scored: 0 killed, 0 timeout, 0 survived, 0 no coverage, 1 error, 1 ignored. The target is zero untriaged survived or no-coverage mutants, and none remain.',
    );
  });

  it('shows its raw counts and the rule of zero survived or no-coverage mutants instead of a percentage', () => {
    const report = build(
      {
        [NEW]: [
          mutant('Killed', 1),
          mutant('Killed', 1),
          mutant('Timeout', 1),
          mutant('Survived', 1),
          mutant('NoCoverage', 1),
          mutant('CompileError', 1),
          mutant('Ignored', 1),
        ],
      },
      created(NEW, 1),
    );
    expect(changeScoreLine(report)).toBe(
      '**Change score:** 5 scored of 7 Changed mutants, fewer than 20 scored: 2 killed, 1 timeout, 1 survived, 1 no coverage, 1 error, 1 ignored. The target is zero untriaged survived or no-coverage mutants, and 2 remain.',
    );
  });

  it('meets its target with no survived or no-coverage mutant', () => {
    expect(changeScoreLine(build({ [NEW]: many(3, 'Killed') }, created(NEW, 1)))).toContain('The target is zero untriaged survived or no-coverage mutants, and none remain.');
  });
});

describe('an incomplete run', () => {
  const diff = created(NEW, 1);

  it('is incomplete, never a score, when the report is missing', () => {
    const report = buildChangeReport({ ...NO_TOLERANCE, report: undefined, diff, mutate: MUTATE, elapsedMs: 1 });

    expect(report.state).toBe('incomplete');
    expect(renderChangeReport(report)).toContain('Incomplete');
    expect(renderChangeReport(report)).not.toMatch(/\d%/);
  });

  it('is incomplete when the report is not JSON', () => {
    expect(
      buildChangeReport({ ...NO_TOLERANCE, report: '{"files": {', diff, mutate: MUTATE, elapsedMs: 1 }).state,
    ).toBe('incomplete');
  });

  it('is incomplete when the report is not a Stryker report', () => {
    expect(
      buildChangeReport({ ...NO_TOLERANCE, report: '{"files": 3}', diff, mutate: MUTATE, elapsedMs: 1 }).state,
    ).toBe('incomplete');
  });

  it('is incomplete when a mutant in the report was never run', () => {
    const report = strykerReport({ [OLD]: many(50, 'Killed'), [NEW]: [mutant('Pending', 1)] });

    expect(buildChangeReport({ ...NO_TOLERANCE, report, diff, mutate: MUTATE, elapsedMs: 1 }).state).toBe(
      'incomplete',
    );
  });

  it('is incomplete when a pending mutant lies outside the change', () => {
    const report = strykerReport({ [OLD]: [mutant('Pending', 1)], [NEW]: many(2, 'Killed') });

    expect(buildChangeReport({ ...NO_TOLERANCE, report, diff, mutate: MUTATE, elapsedMs: 1 }).state).toBe(
      'incomplete',
    );
  });
});

describe('the rendered report', () => {
  const report = build(
    {
      [OLD]: many(97, 'Killed'),
      [NEW]: [...many(19, 'Killed'), mutant('Survived', 2, { mutator: 'EqualityOperator' })],
    },
    created(NEW, 2),
  );
  const markdown = renderChangeReport({ ...report, elapsedMs: 492_000 });

  it('states the Change score against its target, apart from the whole-surface score', () => {
    expect(markdown).toContain(
      '**Change score:** 95.00% of 20 Changed mutants, against a target of 95%',
    );
    expect(markdown).toContain('**Whole-surface score:** 99.15% of 117 mutants');
  });

  it('says the Change score fails nothing', () => {
    expect(markdown).toMatch(/advisory/i);
  });

  it('lists each changed file with its counts and its unkilled mutants', () => {
    expect(markdown).toContain(`| \`${NEW}\` | created | 19 | 1 | 0 | 0 | 0 | 0 | 95.00% |`);
    expect(markdown).toContain(`- \`${NEW}:2:3\` EqualityOperator, Survived`);
  });

  it('states the elapsed time', () => {
    expect(markdown).toContain('8m 12s');
  });
});

describe('the rendered files not measured', () => {
  const report = build(
    { [NEW]: many(20, 'Killed'), [OLD]: many(1, 'Killed', 40), [MOVED]: many(1, 'Killed') },
    [
      created(NEW, 2),
      modified(ROUTER, [1, 1]),
      created(TYPES, 3),
      modified(OLD, [1, 1]),
      deleted('packages/core/src/ledger/domain/gone.ts', 1),
      renamed('packages/core/src/ledger/domain/old-posting.ts', MOVED),
    ].join('\n'),
  );
  const [measured = '', notMeasured = ''] = renderChangeReport(report).split('### Not measured');

  it('lists only the measured file in the table', () => {
    expect(measured).toContain(`| \`${NEW}\` | created |`);
    for (const file of [ROUTER, TYPES, OLD, MOVED, 'gone.ts']) {
      expect(measured).not.toContain(file);
    }
  });

  it('lists every other file apart, with why it was not measured', () => {
    expect(notMeasured).toContain(
      `- \`${ROUTER}\`, modified: excluded, outside the \`mutate\` patterns`,
    );
    expect(notMeasured).toContain(
      `- \`${TYPES}\`, created: non-mutatable, inside the \`mutate\` patterns with no mutant`,
    );
    expect(notMeasured).toContain(
      `- \`${OLD}\`, modified: no Changed mutant, no mutant on an edited line`,
    );
    expect(notMeasured).toContain(
      '- `packages/core/src/ledger/domain/gone.ts`, deleted: contributes nothing',
    );
    expect(notMeasured).toContain(
      `- \`${MOVED}\`, renamed from \`packages/core/src/ledger/domain/old-posting.ts\`: moved with no edited line`,
    );
  });

  it('shows no section of files not measured when every file is measured', () => {
    expect(
      renderChangeReport(build({ [NEW]: many(1, 'Killed') }, created(NEW, 1))),
    ).not.toContain('Not measured');
  });
});

describe('the rendered report of a change with no Changed mutant', () => {
  const markdown = renderChangeReport(
    build({ [OLD]: many(1, 'Killed', 40) }, modified(ROUTER, [1, 1])),
  );

  it('shows N/A rather than a score', () => {
    expect(markdown).toContain('**Change score:** N/A');
    expect(markdown).not.toMatch(/Change score:\*\* \d/);
  });

  it('still lists the files not measured', () => {
    expect(markdown).toContain(`### Not measured\n\n- \`${ROUTER}\`, modified: excluded`);
  });
});

describe('the Stryker configuration', () => {
  it('writes the JSON report the change report reads', () => {
    expect(stryker.reporters).toContain('json');
    expect(stryker.jsonReporter.fileName).toBe('reports/mutation/mutation.json');
  });

  it('keeps the floor of 90', () => {
    expect(stryker.thresholds).toEqual({ high: 95, low: 90, break: 90 });
  });
});

describe('the Change score of a change with no whole-surface measure', () => {
  const local = (files: Record<string, readonly Mutant[]>, diff: string): ChangeReport =>
    buildChangeReport({ ...NO_TOLERANCE,
      measureSurface: false,
      report: strykerReport(files),
      diff,
      mutate: MUTATE,
      elapsedMs: 1,
    });

  const report = local({ [NEW]: [...many(19, 'Killed'), mutant('Survived', 2)] }, created(NEW, 2));

  it('knows no whole-surface score, and renders none', () => {
    expect(complete(report).surface).toBeUndefined();
    expect(renderChangeReport(report)).not.toContain('Whole-surface');
  });

  it('still states the Change score against its target and lists each unkilled mutant', () => {
    const markdown = renderChangeReport(report);
    expect(markdown).toContain('**Change score:** 95.00% of 20 Changed mutants, against a target of 95%');
    expect(markdown).toContain(`- \`${NEW}:2:3\` ConditionalExpression, Survived`);
  });

  it('names a change, not a pull request, when it is not applicable', () => {
    const markdown = renderChangeReport(local({ [OLD]: many(1, 'Killed', 40) }, modified(ROUTER, [1, 1])));
    expect(markdown).toContain('no mutant overlaps a line this change adds or modifies');
  });

  it('counts a block that extends beyond the changed line as a Changed mutant, as the pull request report does', () => {
    const input = {
      ...NO_TOLERANCE,
      report: strykerReport({ [OLD]: [mutant('Survived', 1, { endLine: 30 })] }),
      diff: modified(OLD, [10, 1]),
      mutate: MUTATE,
      elapsedMs: 1,
    };
    expect(complete(buildChangeReport({ ...input, measureSurface: false })).change.mutants).toBe(1);
    expect(complete(buildChangeReport(input)).change.mutants).toBe(1);
  });

  it('leaves the pull request report with its whole-surface score and the change scope', () => {
    const full = complete(
      buildChangeReport({ ...NO_TOLERANCE,
        report: strykerReport({ [OLD]: many(2, 'Killed') }),
        diff: modified(OLD, [1, 1]),
        mutate: MUTATE,
        elapsedMs: 1,
      }),
    );
    expect(full.surface?.mutants).toBe(2);
    expect(full.scope).toBe('change');
  });

  it('lists a file only moved, absent from the report, as moved', () => {
    const markdown = renderChangeReport(local({}, renamed(OLD, MOVED)));
    expect(markdown).toContain(`- \`${MOVED}\`, renamed from \`${OLD}\`: moved with no edited line`);
  });
});

describe('the arguments of the local run', () => {
  it('takes origin/main as the base by default', () => {
    expect(parseLocalArguments([])).toEqual({ ok: true, mode: 'change', base: 'origin/main' });
  });

  it('takes the base named by --base', () => {
    expect(parseLocalArguments(['--base', 'milestone/x'])).toEqual({
      ok: true,
      mode: 'change',
      base: 'milestone/x',
    });
  });

  it('refuses --base with no ref', () => {
    expect(parseLocalArguments(['--base']).ok).toBe(false);
    expect(parseLocalArguments(['--base', '--other']).ok).toBe(false);
  });

  it('refuses an argument it does not know', () => {
    expect(parseLocalArguments(['--other'])).toEqual({ ok: false, problem: 'unknown argument --other' });
  });

  it('takes every path named by a repeated --file', () => {
    expect(parseLocalArguments(['--file', OLD, '--file', NEW])).toEqual({
      ok: true,
      mode: 'file',
      files: [OLD, NEW],
    });
  });

  it('refuses --file with no path', () => {
    expect(parseLocalArguments(['--file']).ok).toBe(false);
    expect(parseLocalArguments(['--file', '--base', 'x']).ok).toBe(false);
  });

  it('refuses --file combined with --base, in either order', () => {
    expect(parseLocalArguments(['--file', OLD, '--base', 'x']).ok).toBe(false);
    expect(parseLocalArguments(['--base', 'x', '--file', OLD]).ok).toBe(false);
  });
});

describe('the plan of the local run', () => {
  const plan = (diff: string, args: readonly string[] = []) =>
    planLocalRun({ args, mutate: MUTATE, readDiff: () => ({ ok: true, diff }), exists: () => true });

  it('hands Stryker each changed file inside the mutate patterns, in path order', () => {
    const diff = [modified(OLD, [3, 1]), created(NEW, 2)].join('\n');
    expect(plan(diff)).toEqual({ kind: 'run', scope: 'change', diff, mutate: [NEW, OLD] });
  });

  it('hands over a file renamed with edits and never a file only moved', () => {
    const diff = [renamed(OLD, NEW, [3, 1]), renamed('packages/core/src/ledger/domain/a.ts', MOVED)].join('\n');
    expect(plan(diff)).toEqual({ kind: 'run', scope: 'change', diff, mutate: [NEW] });
  });

  it('plans no run for a change of deleted, excluded and only moved files, keeping the diff for the report', () => {
    const diff = [deleted(OLD, 3), modified(ROUTER, [1, 1]), renamed('packages/core/src/ledger/domain/a.ts', MOVED)].join('\n');
    expect(plan(diff)).toEqual({ kind: 'none', scope: 'change', diff });
  });

  it('plans no run for an empty change', () => {
    expect(plan('')).toEqual({ kind: 'none', scope: 'change', diff: '' });
  });

  it('reports not applicable, with the files not measured, when no run is planned', () => {
    const planned = plan(deleted(OLD, 3));
    if (planned.kind !== 'none') throw new Error('expected no run');
    const report = complete(
      buildChangeReport({ ...NO_TOLERANCE,
        measureSurface: false,
        report: JSON.stringify({ files: {} }),
        diff: planned.diff,
        mutate: MUTATE,
        elapsedMs: 1,
      }),
    );
    expect(report.change.mutants).toBe(0);
    expect(report.unmeasured.map((file) => file.reason)).toEqual(['deleted']);
  });

  it('returns an argument error without reading the diff', () => {
    let read = false;
    const readDiff: DiffReader = () => {
      read = true;
      return { ok: true, diff: '' };
    };
    const planned = planLocalRun({ args: ['--nope'], mutate: MUTATE, readDiff, exists: () => true });
    expect(planned).toEqual({ kind: 'error', problem: 'unknown argument --nope' });
    expect(read).toBe(false);
  });

  it('reads the diff against the base the arguments name', () => {
    const bases: string[] = [];
    planLocalRun({
      args: ['--base', 'milestone/x'],
      mutate: MUTATE,
      exists: () => true,
      readDiff: (base) => {
        bases.push(base);
        return { ok: true, diff: '' };
      },
    });
    expect(bases).toEqual(['milestone/x']);
  });

  it('returns the reason a diff could not be read', () => {
    const planned = planLocalRun({
      args: [],
      mutate: MUTATE,
      exists: () => true,
      readDiff: () => ({ ok: false, problem: 'no base' }),
    });
    expect(planned).toEqual({ kind: 'error', problem: 'no base' });
  });
});

describe('the File score', () => {
  const planned = (args: readonly string[], exists: (file: string) => boolean = () => true) => {
    let read = false;
    const result = planLocalRun({
      args,
      mutate: MUTATE,
      exists,
      readDiff: () => {
        read = true;
        return { ok: true, diff: '' };
      },
    });
    return { result, read };
  };

  const fileReport = (files: Record<string, readonly Mutant[]>, named: readonly string[]) => {
    const { result } = planned(named.flatMap((file) => ['--file', file]));
    if (result.kind !== 'run') throw new Error('expected a run');
    return buildChangeReport({ ...NO_TOLERANCE,
      scope: result.scope,
      measureSurface: false,
      report: strykerReport(files),
      diff: result.diff,
      mutate: MUTATE,
      elapsedMs: 1,
    });
  };

  it('plans a run over the named files whole, in path order and once each', () => {
    const { result, read } = planned(['--file', OLD, '--file', NEW, '--file', OLD]);
    expect(result).toMatchObject({ kind: 'run', scope: 'file', mutate: [NEW, OLD] });
    expect(read).toBe(false);
  });

  it('counts every mutant of a named file, whatever the lines', () => {
    const report = complete(fileReport({ [OLD]: [...many(18, 'Killed', 400), mutant('Survived', 900)] }, [OLD]));
    expect(report.scope).toBe('file');
    expect(report.change.mutants).toBe(19);
    expect(report.files[0]?.unkilled).toEqual([
      { line: 900, column: 3, mutator: 'ConditionalExpression', status: 'Survived' },
    ]);
  });

  it('counts the way a Change score counts, small sample included', () => {
    const killed = [...many(3, 'Killed'), mutant('Timeout', 4), mutant('CompileError', 5)];
    const file = complete(fileReport({ [OLD]: killed }, [OLD]));
    const change = build({ [OLD]: killed }, created(OLD, 5));
    expect(file.change).toEqual(change.change);
    expect(file.smallSample).toBe(true);
  });

  it('says File score and never Change score, with no whole-surface score', () => {
    const markdown = renderChangeReport(
      fileReport({ [OLD]: [...many(19, 'Killed'), mutant('Survived', 2)] }, [OLD]),
    );
    expect(markdown).toContain('## File score');
    expect(markdown).toContain('**File score:** 95.00% of 20 mutants, against a target of 95%');
    expect(markdown).toContain(`- \`${OLD}:2:3\` ConditionalExpression, Survived`);
    expect(markdown).toContain('The File score is advisory');
    expect(markdown).not.toContain('Change score');
    expect(markdown).not.toContain('Whole-surface');
  });

  it('lists a named file as measured whole, never as created', () => {
    const markdown = renderChangeReport(
      fileReport({ [OLD]: [...many(19, 'Killed'), mutant('Survived', 2)] }, [OLD]),
    );
    expect(markdown).toContain(`| \`${OLD}\` | whole | 19 | 1 | 0 | 0 | 0 | 0 | 95.00% |`);
    expect(markdown).not.toContain('created');
  });

  it('shows raw counts and the rule of zero below 20 scored mutants', () => {
    const markdown = renderChangeReport(fileReport({ [OLD]: [...many(3, 'Killed'), mutant('Survived', 2)] }, [OLD]));
    expect(markdown).toContain('**File score:** 4 scored of 4 mutants, fewer than 20 scored');
    expect(markdown).toContain('The target is zero untriaged survived or no-coverage mutants, and 1 remains.');
  });

  it('lists a named file holding no mutant as not measured', () => {
    const markdown = renderChangeReport(fileReport({ [OLD]: [] }, [OLD]));
    expect(markdown).toContain('**File score:** N/A: the named files hold no mutant.');
    expect(markdown).toContain(`- \`${OLD}\`, whole: non-mutatable`);
  });

  it('is incomplete as a File score, never a Change score, and mentions no whole-surface score', () => {
    const { result } = planned(['--file', OLD]);
    if (result.kind !== 'run') throw new Error('expected a run');
    const markdown = renderChangeReport(
      buildChangeReport({ ...NO_TOLERANCE,
        scope: 'file',
        measureSurface: false,
        report: undefined,
        diff: result.diff,
        mutate: MUTATE,
        elapsedMs: 1,
      }),
    );
    expect(markdown).toContain('There is no File score for this run.');
    expect(markdown).not.toContain('Change score');
    expect(markdown).not.toContain('whole-surface');
  });

  it('refuses a named file outside the mutate patterns, naming it', () => {
    expect(planned(['--file', ROUTER]).result).toEqual({
      kind: 'error',
      problem: `${ROUTER} is outside the mutate patterns`,
    });
  });

  it('refuses a named file that does not exist, naming it', () => {
    expect(planned(['--file', OLD], () => false).result).toEqual({
      kind: 'error',
      problem: `${OLD} does not exist`,
    });
  });

  it('refuses every unmeasurable file at once, so none starts a run', () => {
    const { result } = planned(['--file', OLD, '--file', ROUTER], (file) => file !== OLD);
    expect(result).toEqual({
      kind: 'error',
      problem: `${ROUTER} is outside the mutate patterns; ${OLD} does not exist`,
    });
  });

  it('reads a path written with a leading ./ as the same file', () => {
    expect(planned(['--file', `./${OLD}`]).result).toMatchObject({ mutate: [OLD] });
  });

  it('refuses --file with --base before reading any diff', () => {
    const { result, read } = planned(['--file', OLD, '--base', 'x']);
    expect(result.kind).toBe('error');
    expect(read).toBe(false);
  });
});

describe('the wording of an incomplete change report', () => {
  const diff = created(NEW, 1);

  it('mentions the whole-surface score of a pull request report', () => {
    const markdown = renderChangeReport(
      buildChangeReport({ ...NO_TOLERANCE, report: undefined, diff, mutate: MUTATE, elapsedMs: 1 }),
    );
    expect(markdown).toContain('There is no Change score and no whole-surface score for this run.');
  });

  it('mentions no whole-surface score for a local run', () => {
    const markdown = renderChangeReport(
      buildChangeReport({ ...NO_TOLERANCE, measureSurface: false, report: undefined, diff, mutate: MUTATE, elapsedMs: 1 }),
    );
    expect(markdown).toContain('There is no Change score for this run.');
    expect(markdown).not.toContain('whole-surface');
  });
});

const TEXT = "'a message'";
const BLANK = '""';

const entry = (rest: Record<string, unknown> = {}): Record<string, unknown> => ({
  file: OLD,
  mutator: 'StringLiteral',
  original: TEXT,
  replacement: BLANK,
  reason: 'Nothing branches on the message.',
  recorded: '2026-11-24',
  revisitBy: '2027-05-24',
  ...rest,
});

const without = (field: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(entry()).filter(([key]) => key !== field));

const survivor = (line: number, rest: Partial<Mutant> = {}): Mutant =>
  mutant('Survived', line, {
    mutator: 'StringLiteral',
    original: TEXT,
    replacement: BLANK,
    ...rest,
  });

const toleranceReport = (
  files: Record<string, readonly Mutant[]>,
  diff: string,
  entries: readonly Record<string, unknown>[],
  extra: Partial<Parameters<typeof buildChangeReport>[0]> = {},
): ChangeReport =>
  buildChangeReport({
    report: strykerReport(files),
    register: JSON.stringify(entries),
    diff,
    mutate: MUTATE,
    elapsedMs: 1,
    ...extra,
  });

const invalidReason = (report: ChangeReport): string => {
  if (report.state !== 'invalid') throw new Error(`expected an invalid report, got ${report.state}`);
  return report.reason;
};

describe('a tolerated mutant', () => {
  const files = { [OLD]: [survivor(5), mutant('Killed', 6)] };
  const diff = modified(OLD, [5, 2]);

  it('is listed apart, with its reason and revisit day, instead of among the untriaged', () => {
    const [file] = complete(toleranceReport(files, diff, [entry()])).files;

    expect(file?.unkilled).toEqual([]);
    expect(file?.tolerated).toEqual([
      {
        line: 5,
        column: 3,
        mutator: 'StringLiteral',
        reason: 'Nothing branches on the message.',
        revisitBy: '2027-05-24',
      },
    ]);
  });

  it('leaves every count and score as if the register were empty', () => {
    const tolerated = complete(toleranceReport(files, diff, [entry()]));
    const untouched = complete(toleranceReport(files, diff, []));

    expect(tolerated.change).toEqual(untouched.change);
    expect(tolerated.surface).toEqual(untouched.surface);
    expect(tolerated.change.counts.survived).toBe(1);
    expect(tolerated.change.score).toBe(50);
  });

  it('is still tolerated when its lines have moved', () => {
    const moved = { [OLD]: [survivor(40), mutant('Killed', 41)] };
    const [file] = complete(toleranceReport(moved, modified(OLD, [40, 2]), [entry()])).files;

    expect(file?.tolerated.map(({ line }) => line)).toEqual([40]);
  });

  it('is told apart from a survivor of the same mutator with other text', () => {
    const other = { [OLD]: [survivor(5), survivor(6, { original: "'other'" })] };
    const [file] = complete(toleranceReport(other, modified(OLD, [5, 2]), [entry()])).files;

    expect(file?.tolerated.map(({ line }) => line)).toEqual([5]);
    expect(file?.unkilled.map(({ line }) => line)).toEqual([6]);
  });

  it('is not tolerated when the replacement, the mutator or the file differs', () => {
    for (const other of [{ replacement: '"x"' }, { mutator: 'Other' }, { file: NEW }]) {
      const [file] = complete(toleranceReport(files, diff, [entry(other)])).files;
      expect(file?.tolerated).toEqual([]);
      expect(file?.unkilled).toHaveLength(1);
    }
  });

  it('is never a no-coverage mutant', () => {
    const uncovered = { [OLD]: [survivor(5, { status: 'NoCoverage' })] };
    const [file] = complete(toleranceReport(uncovered, diff, [entry()])).files;

    expect(file?.tolerated).toEqual([]);
    expect(file?.unkilled).toEqual([
      { line: 5, column: 3, mutator: 'StringLiteral', status: 'NoCoverage' },
    ]);
  });

  it('is not tolerated when the entry matches a second mutant of the file', () => {
    const twice = { [OLD]: [survivor(5), survivor(6)] };
    const [file] = complete(toleranceReport(twice, modified(OLD, [5, 2]), [entry()])).files;

    expect(file?.tolerated).toEqual([]);
    expect(file?.unkilled).toHaveLength(2);
  });

  it('is counted by the small sample against a target of zero untriaged mutants only', () => {
    const tolerated = complete(toleranceReport(files, diff, [entry()]));
    const untriaged = complete(toleranceReport(files, diff, []));

    expect(tolerated.smallSample).toBe(true);
    expect(tolerated.untriaged).toBe(0);
    expect(untriaged.untriaged).toBe(1);
    expect(changeScoreLine(tolerated)).toContain('and none remain.');
    expect(changeScoreLine(untriaged)).toContain('and 1 remains.');
  });

  it('counts a no-coverage mutant beside a tolerated survivor as untriaged', () => {
    const both = { [OLD]: [survivor(5), mutant('NoCoverage', 6)] };
    const report = complete(toleranceReport(both, modified(OLD, [5, 2]), [entry()]));

    expect(report.untriaged).toBe(1);
    expect(changeScoreLine(report)).toContain('and 1 remains.');
  });

  it('is rendered in its own section, with its reason and revisit day', () => {
    const markdown = renderChangeReport(toleranceReport(files, diff, [entry()]));

    expect(markdown).toContain('### Tolerated');
    expect(markdown).toContain(
      `- \`${OLD}:5:3\` StringLiteral, tolerated: Nothing branches on the message. Revisit by 2027-05-24.`,
    );
    expect(markdown).not.toContain('### Survived and no coverage');
  });

  it('keeps an untriaged survivor in its own section beside the tolerated one', () => {
    const both = { [OLD]: [survivor(5), mutant('Survived', 6)] };
    const markdown = renderChangeReport(toleranceReport(both, modified(OLD, [5, 2]), [entry()]));

    expect(markdown).toContain(`- \`${OLD}:6:3\` ConditionalExpression, Survived`);
    expect(markdown).toContain('### Tolerated');
  });

  it('shows no section when nothing is tolerated', () => {
    expect(renderChangeReport(toleranceReport(files, diff, []))).not.toContain('### Tolerated');
  });

  it('applies to the File score the same way', () => {
    const report = complete(
      toleranceReport({ [OLD]: [survivor(5)] }, created(OLD, 1), [entry()], {
        scope: 'file',
        measureSurface: false,
      }),
    );

    expect(report.files[0]?.tolerated).toHaveLength(1);
    expect(report.change.score).toBe(0);
    expect(report.untriaged).toBe(0);
  });
});

describe('an invalid register', () => {
  const files = { [OLD]: [survivor(5)] };
  const diff = modified(OLD, [5, 1]);
  const invalid = (register: string | undefined): string =>
    invalidReason(toleranceReport(files, diff, [], { register }));
  const invalidEntries = (...entries: readonly Record<string, unknown>[]): string =>
    invalidReason(toleranceReport(files, diff, entries));

  it('is reported when the file is missing', () => {
    expect(invalid(undefined)).toContain('is missing');
  });

  it('is reported when the file is not JSON', () => {
    expect(invalid('[{')).toContain('is not valid JSON');
  });

  it('is reported when the file is not an array of entries', () => {
    expect(invalid('{"entries": []}')).toContain('is not an array');
    expect(invalid('null')).toContain('is not an array');
  });

  it('is reported for an entry that is not an object', () => {
    expect(invalid('["x"]')).toContain('entry 1');
  });

  it('is reported for each missing field, naming it', () => {
    for (const field of ['file', 'mutator', 'original', 'replacement', 'reason', 'recorded', 'revisitBy']) {
      expect(invalidEntries(without(field))).toContain(`\`${field}\``);
    }
  });

  it('is reported for a field that is not a string', () => {
    expect(invalidEntries(entry({ file: 3 }))).toContain('`file`');
  });

  it('is reported for a field beyond the seven', () => {
    expect(invalidEntries(entry({ approver: 'me' }))).toContain('`approver`');
  });

  it('is reported for an empty original', () => {
    expect(invalidEntries(entry({ original: '' }))).toContain('empty `original`');
  });

  it('is reported for an empty or blank reason', () => {
    expect(invalidEntries(entry({ reason: '' }))).toContain('empty `reason`');
    expect(invalidEntries(entry({ reason: '   ' }))).toContain('empty `reason`');
  });

  it('is reported for a malformed or impossible date', () => {
    for (const bad of ['2026-1-24', '24-11-2026', '2026-13-01', '2026-02-30', 'tomorrow']) {
      expect(invalidEntries(entry({ recorded: bad }))).toContain('`recorded`');
      expect(invalidEntries(entry({ revisitBy: bad }))).toContain('`revisitBy`');
    }
  });

  it('is reported for a revisit day before the recorded day', () => {
    expect(invalidEntries(entry({ revisitBy: '2026-11-23' }))).toContain('before');
  });

  it('accepts a revisit day on the recorded day and on the last day of six months', () => {
    expect(complete(toleranceReport(files, diff, [entry({ revisitBy: '2026-11-24' })])).files).toHaveLength(1);
    expect(complete(toleranceReport(files, diff, [entry({ revisitBy: '2027-05-24' })])).files).toHaveLength(1);
  });

  it('is reported for a revisit day more than six months after the recorded day', () => {
    expect(invalidEntries(entry({ revisitBy: '2027-05-25' }))).toContain('more than six months');
  });

  it('measures six calendar months, clamping a short month and crossing a year', () => {
    const clamped = entry({ recorded: '2026-08-31', revisitBy: '2027-02-28' });
    const past = entry({ recorded: '2026-08-31', revisitBy: '2027-03-01' });
    const crossing = entry({ recorded: '2026-12-31', revisitBy: '2027-06-30' });
    const over = entry({ recorded: '2026-12-31', revisitBy: '2027-07-01' });

    expect(complete(toleranceReport(files, diff, [clamped])).files).toHaveLength(1);
    expect(invalidEntries(past)).toContain('more than six months');
    expect(complete(toleranceReport(files, diff, [crossing])).files).toHaveLength(1);
    expect(invalidEntries(over)).toContain('more than six months');
  });

  it('is reported when two entries match the same mutant', () => {
    expect(invalidEntries(entry(), entry({ reason: 'Another reason.' }))).toContain(
      'two entries of the register match the same mutant',
    );
  });

  it('is not reported for two entries that match different mutants', () => {
    const two = { [OLD]: [survivor(5), survivor(6, { original: "'other'" })] };
    const report = toleranceReport(two, modified(OLD, [5, 2]), [entry(), entry({ original: "'other'" })]);

    expect(complete(report).files[0]?.tolerated).toHaveLength(2);
  });

  it('is reported even when the doubly matched mutant lies outside the change', () => {
    const far = { [OLD]: [survivor(50)] };

    expect(toleranceReport(far, diff, [entry(), entry()]).state).toBe('invalid');
  });

  it('names the cause in the rendered report, with no score, and says the step fails', () => {
    const markdown = renderChangeReport(toleranceReport(files, diff, [], { register: undefined }));

    expect(markdown).toContain('## Change score');
    expect(markdown).toContain('**Invalid:** the register tolerated-mutants.json is missing.');
    expect(markdown).toContain('the step fails');
    expect(markdown).not.toContain('**Change score:**');
  });

  it('says File score for a File score run', () => {
    const markdown = renderChangeReport(
      toleranceReport(files, diff, [], { register: undefined, scope: 'file', measureSurface: false }),
    );

    expect(markdown).toContain('## File score');
    expect(markdown).not.toContain('whole-surface');
  });

  it('reports an incomplete Stryker run before a register it cannot check', () => {
    const report = toleranceReport(files, diff, [], { report: undefined, register: undefined });

    expect(report.state).toBe('incomplete');
  });
});

describe('a Stryker report that cannot give a mutant its identity', () => {
  const diff = created(NEW, 1);
  const withMutant = (change: (m: Record<string, unknown>) => void, source: unknown = 'x'): string => {
    const mutantResult: Record<string, unknown> = {
      id: '0',
      mutatorName: 'StringLiteral',
      replacement: '""',
      status: 'Survived',
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
    };
    change(mutantResult);
    return JSON.stringify({ files: { [NEW]: { source, mutants: [mutantResult] } } });
  };
  const stateOf = (report: string): string =>
    buildChangeReport({ ...NO_TOLERANCE, report, diff, mutate: MUTATE, elapsedMs: 1 }).state;

  it('is complete when every mutant has its replacement and every file its source', () => {
    expect(stateOf(withMutant(() => undefined))).toBe('complete');
  });

  it('is incomplete when a mutant has no replacement', () => {
    expect(stateOf(withMutant((m) => delete m['replacement']))).toBe('incomplete');
    expect(stateOf(withMutant((m) => (m['replacement'] = 3)))).toBe('incomplete');
  });

  it('is incomplete when a file has no source', () => {
    expect(stateOf(withMutant(() => undefined, null))).toBe('incomplete');
    expect(stateOf(withMutant(() => undefined, 3))).toBe('incomplete');
  });
});

describe('the register of the repository', () => {
  const register = readFileSync(path.join(REPO_ROOT, TOLERATED_REGISTER), 'utf8');

  it('is valid, whatever the mutants', () => {
    expect(toleranceReport({}, '', [], { register }).state).toBe('complete');
  });

  it('tolerates the two message survivors of the health domain', () => {
    const entries = JSON.parse(register) as readonly { file: string }[];

    expect(entries.map(({ file }) => file)).toEqual([
      'packages/core/src/health/domain/status.ts',
      'packages/core/src/health/domain/status.ts',
    ]);
  });
});
