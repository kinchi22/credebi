import { describe, expect, it } from 'vitest';
import stryker from '../../stryker.config';
import {
  buildChangeReport,
  parseLocalArguments,
  planLocalRun,
  type DiffReader,
  renderChangeReport,
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
};

const MUTATE = stryker.mutate;

const mutant = (status: Status, line: number, rest: Partial<Mutant> = {}): Mutant => ({
  status,
  line,
  ...rest,
});

const many = (count: number, status: Status, line = 1): readonly Mutant[] =>
  Array.from({ length: count }, () => mutant(status, line));

const strykerReport = (files: Record<string, readonly Mutant[]>): string =>
  JSON.stringify({
    schemaVersion: '1.0',
    thresholds: { high: 95, low: 90, break: 90 },
    files: Object.fromEntries(
      Object.entries(files).map(([name, mutants]) => [
        name,
        {
          language: 'typescript',
          source: '',
          mutants: mutants.map((m, index) => ({
            id: `${name}#${String(index)}`,
            mutatorName: m.mutator ?? 'ConditionalExpression',
            status: m.status,
            location: {
              start: { line: m.line, column: 3 },
              end: { line: m.endLine ?? m.line, column: m.endColumn ?? 9 },
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
  complete(buildChangeReport({ report: strykerReport(files), diff, mutate: MUTATE, elapsedMs: 1 }));

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
      },
      {
        path: OLD,
        kind: 'modified',
        counts: { killed: 0, survived: 1, noCoverage: 0, timeout: 0, errors: 0, ignored: 0 },
        score: 0,
        unkilled: [{ line: 4, column: 3, mutator: 'BlockStatement', status: 'Survived' }],
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
      '**Change score:** 0 scored of 2 Changed mutants, fewer than 20 scored: 0 killed, 0 timeout, 0 survived, 0 no coverage, 1 error, 1 ignored. The target is zero survived or no-coverage mutants, and none remain.',
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
      '**Change score:** 5 scored of 7 Changed mutants, fewer than 20 scored: 2 killed, 1 timeout, 1 survived, 1 no coverage, 1 error, 1 ignored. The target is zero survived or no-coverage mutants, and 2 remain.',
    );
  });

  it('meets its target with no survived or no-coverage mutant', () => {
    expect(changeScoreLine(build({ [NEW]: many(3, 'Killed') }, created(NEW, 1)))).toContain('The target is zero survived or no-coverage mutants, and none remain.');
  });
});

describe('an incomplete run', () => {
  const diff = created(NEW, 1);

  it('is incomplete, never a score, when the report is missing', () => {
    const report = buildChangeReport({ report: undefined, diff, mutate: MUTATE, elapsedMs: 1 });

    expect(report.state).toBe('incomplete');
    expect(renderChangeReport(report)).toContain('Incomplete');
    expect(renderChangeReport(report)).not.toMatch(/\d%/);
  });

  it('is incomplete when the report is not JSON', () => {
    expect(
      buildChangeReport({ report: '{"files": {', diff, mutate: MUTATE, elapsedMs: 1 }).state,
    ).toBe('incomplete');
  });

  it('is incomplete when the report is not a Stryker report', () => {
    expect(
      buildChangeReport({ report: '{"files": 3}', diff, mutate: MUTATE, elapsedMs: 1 }).state,
    ).toBe('incomplete');
  });

  it('is incomplete when a mutant in the report was never run', () => {
    const report = strykerReport({ [OLD]: many(50, 'Killed'), [NEW]: [mutant('Pending', 1)] });

    expect(buildChangeReport({ report, diff, mutate: MUTATE, elapsedMs: 1 }).state).toBe(
      'incomplete',
    );
  });

  it('is incomplete when a pending mutant lies outside the change', () => {
    const report = strykerReport({ [OLD]: [mutant('Pending', 1)], [NEW]: many(2, 'Killed') });

    expect(buildChangeReport({ report, diff, mutate: MUTATE, elapsedMs: 1 }).state).toBe(
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
    buildChangeReport({
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
      buildChangeReport({
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
      buildChangeReport({
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
    return buildChangeReport({
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

  it('shows raw counts and the rule of zero below 20 scored mutants', () => {
    const markdown = renderChangeReport(fileReport({ [OLD]: [...many(3, 'Killed'), mutant('Survived', 2)] }, [OLD]));
    expect(markdown).toContain('**File score:** 4 scored of 4 mutants, fewer than 20 scored');
    expect(markdown).toContain('The target is zero survived or no-coverage mutants, and 1 remains.');
  });

  it('lists a named file holding no mutant as not measured', () => {
    const markdown = renderChangeReport(fileReport({ [OLD]: [] }, [OLD]));
    expect(markdown).toContain('**File score:** N/A: the named files hold no mutant.');
    expect(markdown).toContain(`- \`${OLD}\`, created: non-mutatable`);
  });

  it('is incomplete as a File score, never a Change score, and mentions no whole-surface score', () => {
    const { result } = planned(['--file', OLD]);
    if (result.kind !== 'run') throw new Error('expected a run');
    const markdown = renderChangeReport(
      buildChangeReport({
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
      buildChangeReport({ report: undefined, diff, mutate: MUTATE, elapsedMs: 1 }),
    );
    expect(markdown).toContain('There is no Change score and no whole-surface score for this run.');
  });

  it('mentions no whole-surface score for a local run', () => {
    const markdown = renderChangeReport(
      buildChangeReport({ measureSurface: false, report: undefined, diff, mutate: MUTATE, elapsedMs: 1 }),
    );
    expect(markdown).toContain('There is no Change score for this run.');
    expect(markdown).not.toContain('whole-surface');
  });
});
