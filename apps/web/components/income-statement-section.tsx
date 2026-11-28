import { type SearchQuery } from '@repo/contracts';
import { type ReactNode } from 'react';
import { answerIncomeStatement } from '../server/income-statement';
import { INCOME_STATEMENT_PATH, pathWithQuery } from '../server/return-path';
import { withSectionFault } from '../server/section-fault-request';
import { readOfRequest } from '../server/signed-in-read-request';
import { IncomeStatementOutcome } from './income-statement-tables';
import { type KeepCollapsed } from './statement-group';

export type IncomeStatementSectionProps = {
  readonly query: SearchQuery;
  readonly keep: KeepCollapsed;
};

export async function IncomeStatementSection({ query, keep }: IncomeStatementSectionProps): Promise<ReactNode> {
  const path = pathWithQuery(INCOME_STATEMENT_PATH, query);
  const answer = await withSectionFault('income-statement.report', () =>
    answerIncomeStatement((period) => readOfRequest(path, (caller) => caller.entries.incomeStatement(period)), query),
  );
  return <IncomeStatementOutcome answer={answer} keep={keep} />;
}
