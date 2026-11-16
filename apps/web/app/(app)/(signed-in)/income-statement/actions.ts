'use server';

import { keepCollapsedGroup } from '../../../../server/collapsed-group';
import { createContext } from '../../../../server/context';
import {
  answerDefaultRangeStatement,
  type IncomeStatementAnswer,
} from '../../../../server/income-statement';
import { INCOME_STATEMENT_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';

export async function showDefaultRange(range: unknown): Promise<IncomeStatementAnswer> {
  const caller = createCaller(await createContext());
  return answerDefaultRangeStatement(
    (period) => orSignIn(caller.entries.incomeStatement(period), INCOME_STATEMENT_PATH),
    range,
  );
}

export async function keepCollapsed(id: unknown, collapsed: unknown): Promise<void> {
  const context = await createContext();
  const caller = createCaller(context);
  await keepCollapsedGroup(
    (input) => caller.accounts.collapseGroup(input),
    context.container.logger,
    id,
    collapsed,
  );
}
