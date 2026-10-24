import { type IncomeStatementOutput, type StatementSectionOutput } from '@repo/contracts';

export type StatementSectionName = 'revenue' | 'expense';

const rowCount = (section: StatementSectionOutput): number =>
  section.rows.reduce((count, row) => count + 1 + (row.kind === 'group' ? row.accounts.length : 0), 1);

export function totalsUnder(statement: IncomeStatementOutput): StatementSectionName {
  return rowCount(statement.expense) < rowCount(statement.revenue) ? 'expense' : 'revenue';
}
