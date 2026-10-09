import {
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type AccountNames } from '../../accounts/domain/account';
import { memoLength, MEMO_MAX_LENGTH } from './entry';

export type SearchCriteriaDraft = {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly account?: string | undefined;
  readonly memo?: string | undefined;
};

export type SearchCriteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: AccountId;
  readonly memo?: string;
};

export const NO_CRITERIA: SearchCriteria = {};

export function makeSearchCriteria(
  draft: SearchCriteriaDraft,
  names: AccountNames,
): Result<SearchCriteria, DomainError> {
  const { from, to } = draft;
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
    return err(
      domainError('INVALID_INPUT', `A day range cannot end (${to}) before it starts (${from}).`),
    );
  }

  if (memoLength(memo) > MEMO_MAX_LENGTH) {
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
    ...(memo === '' ? {} : { memo }),
  });
}
