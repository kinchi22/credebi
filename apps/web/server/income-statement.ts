import {
  incomeStatementQuerySchema,
  parseIncomeStatementQuery,
  type IncomeStatementOutput,
  type IncomeStatementQuery,
  type SearchQuery,
} from '@repo/contracts';
import { unanswered, type Unanswered } from './report-outcome';

export type ShowIncomeStatement = (period: IncomeStatementQuery) => Promise<IncomeStatementOutput>;

export type StatementPeriod = Partial<IncomeStatementQuery>;

export type IncomeStatementAnswer =
  | {
      readonly outcome: 'answered';
      readonly period: IncomeStatementQuery;
      readonly statement: IncomeStatementOutput;
    }
  | { readonly outcome: Unanswered; readonly period: StatementPeriod };

export type ShownIncomeStatementAnswer = Exclude<IncomeStatementAnswer, { readonly outcome: 'unavailable' }>;

export function periodOfQuery(query: SearchQuery): StatementPeriod {
  const period = parseIncomeStatementQuery(query);
  return period.ok ? period.value : {};
}

export async function answerIncomeStatement(
  show: ShowIncomeStatement,
  query: SearchQuery,
): Promise<IncomeStatementAnswer> {
  const period = parseIncomeStatementQuery(query);
  if (!period.ok) {
    return { outcome: 'refused', period: {} };
  }

  try {
    return { outcome: 'answered', period: period.value, statement: await show(period.value) };
  } catch (thrown) {
    return { outcome: unanswered(thrown), period: period.value };
  }
}

export async function answerDefaultRangeStatement(
  show: ShowIncomeStatement,
  range: unknown,
): Promise<IncomeStatementAnswer> {
  const parsed = incomeStatementQuerySchema.safeParse(range);
  if (!parsed.success) {
    return { outcome: 'refused', period: {} };
  }
  return answerIncomeStatement(show, parsed.data);
}
