import {
  incomeStatementQuerySchema,
  parseIncomeStatementQuery,
  type DomainErrorCode,
  type IncomeStatementOutput,
  type IncomeStatementQuery,
  type SearchQuery,
} from '@repo/contracts';
import { fromTrpcError } from './domain-error';

export type ShowIncomeStatement = (period: IncomeStatementQuery) => Promise<IncomeStatementOutput>;

export type StatementPeriod = Partial<IncomeStatementQuery>;

type Unanswered = 'refused' | 'unavailable';

export type IncomeStatementAnswer =
  | {
      readonly outcome: 'answered';
      readonly period: StatementPeriod;
      readonly statement: IncomeStatementOutput;
    }
  | { readonly outcome: Unanswered; readonly period: StatementPeriod };

const UNANSWERED: Partial<Record<DomainErrorCode, Unanswered>> = {
  INVALID_INPUT: 'refused',
  DEPENDENCY_UNAVAILABLE: 'unavailable',
};

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
    const outcome = UNANSWERED[fromTrpcError(thrown).code];
    if (outcome === undefined) {
      throw thrown;
    }
    return { outcome, period: period.value };
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
