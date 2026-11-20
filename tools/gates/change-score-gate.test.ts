import { describe, expect, it } from 'vitest';
import stryker from '../../stryker.config';
import {
  buildChangeReport,
  CHANGE_TARGET,
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

const MUTATE = [
  'packages/core/src/*/{domain,application}/**/*.ts',
  'apps/web/server/**/*.ts',
  '!apps/web/server/routers/**',
  '!**/*.test.ts',
];

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

const modified = (file: string, ...hunks: readonly (readonly [number, number])[]): string =>
  [
    `diff --git a/${file} b/${file}`,
    'index 1111111..2222222 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    ...hunks.flatMap(([start, count]) => [
      `@@ -${String(start)},${String(count)} +${String(start)},${String(count)} @@`,
      ...Array.from({ length: count }, () => '-old'),
      ...Array.from({ length: count }, () => '+new'),
    ]),
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

const OLD = 'packages/core/src/ledger/domain/entry.ts';
const NEW = 'packages/core/src/ledger/domain/balance.ts';

describe('the Change score', () => {
  it('scores a new file whose tests kill nothing low while the whole surface stays above the floor', () => {
    const report = build(
      { [OLD]: many(200, 'Killed'), [NEW]: many(10, 'Survived', 2) },
      created(NEW, 4),
    );

    expect(report.change).toEqual({ mutants: 10, score: 0 });
    expect(report.surface.score).toBeGreaterThanOrEqual(90);
    expect(report.surface.mutants).toBe(210);
  });

  it('counts every mutant of a file the pull request creates, beyond the lines of its hunks', () => {
    const report = build({ [NEW]: [mutant('Killed', 1), mutant('Survived', 40)] }, created(NEW, 2));

    expect(report.change).toEqual({ mutants: 2, score: 50 });
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

    expect(report.change).toEqual({ mutants: 2, score: 0 });
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

    expect(report.change).toEqual({ mutants: 2, score: 50 });
  });

  it('counts a mutant that starts before a hunk and ends inside it', () => {
    const report = build(
      { [OLD]: [mutant('Survived', 5, { endLine: 10 }), mutant('Killed', 5, { endLine: 9 })] },
      modified(OLD, [10, 1]),
    );

    expect(report.change).toEqual({ mutants: 1, score: 0 });
  });

  it('does not count a mutant whose exclusive end falls at the first column of a hunk', () => {
    const report = build(
      { [OLD]: [mutant('Survived', 5, { endLine: 10, endColumn: 1 })] },
      modified(OLD, [10, 1]),
    );

    expect(report.change).toEqual({ mutants: 0, score: null });
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

    expect(report.change).toEqual({ mutants: 0, score: null });
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

    expect(report.change).toEqual({ mutants: 1, score: 100 });
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

    expect(report.change).toEqual({ mutants: 7, score: 50 });
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

    expect(report.change).toEqual({ mutants: 0, score: null });
    const changeLine = renderChangeReport(report)
      .split('\n')
      .find((line) => line.startsWith('**Change score:**'));
    expect(changeLine).toContain('not applicable');
    expect(changeLine).not.toContain('100');
  });

  it('counts no file outside the mutate patterns, even when the report holds it', () => {
    const router = 'apps/web/server/routers/ledger.ts';
    const report = build({ [router]: many(2, 'Survived') }, created(router, 3));

    expect(report.change).toEqual({ mutants: 0, score: null });
    expect(report.files).toEqual([]);
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
      [NEW]: [mutant('Killed', 1), mutant('Survived', 2, { mutator: 'EqualityOperator' })],
    },
    created(NEW, 2),
  );
  const markdown = renderChangeReport({ ...report, elapsedMs: 492_000 });

  it('states the Change score against its target, apart from the whole-surface score', () => {
    expect(markdown).toContain(
      `**Change score:** 50.00% of 2 Changed mutants, against a target of ${String(CHANGE_TARGET)}%`,
    );
    expect(markdown).toContain('**Whole-surface score:** 98.99% of 99 mutants');
  });

  it('says the Change score fails nothing', () => {
    expect(markdown).toMatch(/advisory/i);
  });

  it('lists each changed file with its counts and its unkilled mutants', () => {
    expect(markdown).toContain(`| \`${NEW}\` | created | 1 | 1 | 0 | 0 | 0 | 50.00% |`);
    expect(markdown).toContain(`- \`${NEW}:2:3\` EqualityOperator, Survived`);
  });

  it('states the elapsed time', () => {
    expect(markdown).toContain('8m 12s');
  });

  it('targets 95', () => {
    expect(CHANGE_TARGET).toBe(95);
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
