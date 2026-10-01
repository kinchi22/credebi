'use server';

import { type DayRange } from '@repo/core/entries';
import { createContext } from '../../../../../server/context';
import { answerEntrySearch, type EntrySearchAnswer } from '../../../../../server/entry-search';
import { ENTRY_SEARCH_PATH } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';
import { orSignIn } from '../../../../../server/sign-in-redirect';

export async function searchDefaultRange(range: DayRange): Promise<EntrySearchAnswer> {
  const caller = createCaller(await createContext());
  return answerEntrySearch(
    (criteria) => orSignIn(caller.entries.search(criteria), ENTRY_SEARCH_PATH),
    { from: range.from, to: range.to },
  );
}
