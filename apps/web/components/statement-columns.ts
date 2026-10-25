import { type StatementSectionOutput } from '@repo/contracts';

export type StatementColumn = 'left' | 'right';

const rowCount = (section: StatementSectionOutput): number =>
  section.rows.reduce((count, row) => count + 1 + (row.kind === 'group' ? row.accounts.length : 0), 1);

export function totalsUnder(left: StatementSectionOutput, right: StatementSectionOutput): StatementColumn {
  return rowCount(left) < rowCount(right) ? 'left' : 'right';
}
