'use server';

import {
  answerDefaultDayReport,
  type AssetsAndLiabilitiesAnswer,
} from '../../../../server/assets-and-liabilities';
import { keepCollapsedGroup } from '../../../../server/collapsed-group';
import { createContext } from '../../../../server/context';
import { ASSETS_AND_LIABILITIES_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { orSignIn } from '../../../../server/sign-in-redirect';

export async function showDefaultDay(day: unknown): Promise<AssetsAndLiabilitiesAnswer> {
  const caller = createCaller(await createContext());
  return answerDefaultDayReport(
    (query) => orSignIn(caller.entries.assetsAndLiabilities(query), ASSETS_AND_LIABILITIES_PATH),
    day,
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
