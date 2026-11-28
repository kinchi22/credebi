'use server';

import {
  answerDefaultDayReport,
  type AssetsAndLiabilitiesAnswer,
} from '../../../../server/assets-and-liabilities';
import { createContext } from '../../../../server/context';
import { ASSETS_AND_LIABILITIES_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';
import { withSectionFault } from '../../../../server/section-fault-request';
import { orSignIn } from '../../../../server/sign-in-redirect';

export async function showDefaultDay(day: unknown): Promise<AssetsAndLiabilitiesAnswer> {
  const caller = createCaller(await createContext());
  return withSectionFault('assets-and-liabilities.report', () =>
    answerDefaultDayReport(
      (query) => orSignIn(caller.entries.assetsAndLiabilities(query), ASSETS_AND_LIABILITIES_PATH),
      day,
    ),
  );
}
