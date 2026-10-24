import {
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type AccountNames } from '../../accounts/domain/account';
import { reversedRange } from './search-range';
import { MEMO_MAX_LENGTH, TITLE_MAX_LENGTH, textLength } from './entry';

export type SearchCriteriaDraft = {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly account?: string | undefined;
  readonly title?: string | undefined;
  readonly memo?: string | undefined;
};

export type SearchCriteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: AccountId;
  readonly title?: string;
  readonly memo?: string;
};

export const NO_CRITERIA: SearchCriteria = {};

export function makeSearchCriteria(
  draft: SearchCriteriaDraft,
  names: AccountNames,
): Result<SearchCriteria, DomainError> {
  const { from, to } = draft;
  const title = draft.title === undefined ? '' : draft.title.trim();
  const memo = draft.memo === undefined ? '' : draft.memo.trim();
  const account = draft.account === undefined ? undefined : names.get(draft.account)?.id;
  if (draft.account !== undefined && account === undefined) {
    return err(
      domainError(
        'INVALID_INPUT',
        `Account "${draft.account}" is not in the User's chart of accounts.`,
      ),
    );
  }
  if (from !== undefined && to !== undefined && from > to) {
    return reversedRange(from, to);
  }

  if (textLength(title) > TITLE_MAX_LENGTH) {
    return err(
      domainError(
        'INVALID_INPUT',
        `A Title can be at most ${String(TITLE_MAX_LENGTH)} characters, so no longer Title can match.`,
      ),
    );
  }

  if (textLength(memo) > MEMO_MAX_LENGTH) {
    return err(
      domainError(
        'INVALID_INPUT',
        `A memo term can be at most ${String(MEMO_MAX_LENGTH)} characters, the length of a memo.`,
      ),
    );
  }

  return ok({
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(account === undefined ? {} : { account }),
    ...(title === '' ? {} : { title }),
    ...(memo === '' ? {} : { memo }),
  });
}
