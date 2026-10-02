'use server';

import { createContext } from '../../../../../server/context';
import { answerDefaultRangeSearch, type EntrySearchAnswer } from '../../../../../server/entry-search';
import { ENTRY_SEARCH_PATH } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { orSignIn } from '../../../../../server/sign-in-redirect';

export async function searchDefaultRange(range: unknown): Promise<EntrySearchAnswer> {
  const caller = createCaller(await createContext());
  return answerDefaultRangeSearch(
    (criteria) => orSignIn(caller.entries.search(criteria), ENTRY_SEARCH_PATH),
    range,
  );
}
