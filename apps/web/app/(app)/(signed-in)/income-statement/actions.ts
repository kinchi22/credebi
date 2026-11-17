'use server';

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
