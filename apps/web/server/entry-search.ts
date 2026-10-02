import {
  parseSearchQuery,
  searchCriteriaSchema,
  type PostedEntry,
  type SearchCriteriaInput,
  type SearchQuery,
} from '@repo/contracts';
import { NO_CRITERIA } from '@repo/core';
import { fromTrpcError } from './domain-error';

export type SearchForEntries = (
  criteria: SearchCriteriaInput,
) => Promise<readonly PostedEntry[]>;

export type EntrySearchAnswer =
  | {
      readonly outcome: 'answered';
      readonly criteria: SearchCriteriaInput;
      readonly entries: readonly PostedEntry[];
    }
  | { readonly outcome: 'refused'; readonly criteria: SearchCriteriaInput };

export async function answerEntrySearch(
  search: SearchForEntries,
  query: SearchQuery,
): Promise<EntrySearchAnswer> {
  const parsed = parseSearchQuery(query);
  const criteria = parsed.ok ? parsed.value : NO_CRITERIA;

  let entries: readonly PostedEntry[];
  try {
    entries = await search(criteria);
  } catch (thrown) {
    if (fromTrpcError(thrown).code === 'INVALID_INPUT') {
      return { outcome: 'refused', criteria };
    }
    throw thrown;
  }

  return parsed.ok ? { outcome: 'answered', criteria, entries } : { outcome: 'refused', criteria };
}

const defaultRangeSchema = searchCriteriaSchema.pick({ from: true, to: true }).required();

export async function answerDefaultRangeSearch(
  search: SearchForEntries,
  range: unknown,
): Promise<EntrySearchAnswer> {
  const parsed = defaultRangeSchema.safeParse(range);
  if (!parsed.success) {
    return { outcome: 'refused', criteria: {} };
  }
  return answerEntrySearch(search, parsed.data);
}
