import {
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type Account } from './account';

export type ActivePeriod = Pick<Account, 'activeFrom' | 'activeUntil'>;

export type ShownSpan = {
  readonly first: string;
  readonly last: string;
};

export function isActiveOn(period: ActivePeriod, day: string): boolean {
  return period.activeFrom <= day && (period.activeUntil === null || day <= period.activeUntil);
}

export function hasEndedBy(period: ActivePeriod, day: string): boolean {
  return period.activeUntil !== null && period.activeUntil < day;
}

export function endedLast<Period extends ActivePeriod>(
  accounts: readonly Period[],
  day: string,
): Period[] {
  return [
    ...accounts.filter((account) => !hasEndedBy(account, day)),
    ...accounts.filter((account) => hasEndedBy(account, day)),
  ];
}

export function checkActiveOn(
  accounts: readonly Account[],
  day: string,
  named: readonly AccountId[],
): Result<void, DomainError> {
  const inactive = accounts.find(
    (account) => named.includes(account.id) && !isActiveOn(account, day),
  );
  return inactive === undefined
    ? ok(undefined)
    : err(
        domainError(
          'INVALID_INPUT',
          `Account "${inactive.name}" is not active on ${day}, outside its Active period.`,
        ),
      );
}

export function checkKeepsShownEntries(
  account: Account,
  shown: ShownSpan | null,
): Result<void, DomainError> {
  if (shown === null || (isActiveOn(account, shown.first) && isActiveOn(account, shown.last))) {
    return ok(undefined);
  }
  return err(
    domainError(
      'IN_USE',
      `An Entry names Account "${account.name}" on a day outside the new Active period, so the period was not changed.`,
    ),
  );
}
