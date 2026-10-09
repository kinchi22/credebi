import {
  domainError,
  err,
  ok,
  type AccountDetailsInput,
  type AccountId,
  type AccountType,
  type DomainError,
  type Err,
  type Result,
} from '@repo/contracts';
import { type Account } from './account';

export const NAME_MAX_LENGTH = 40;
export const DESCRIPTION_MAX_LENGTH = 200;

type AccountDetails = Pick<Account, 'name' | 'description' | 'activeFrom' | 'activeUntil'>;

const characters = (text: string): number => Array.from(text).length;

const invalid = (message: string): Err<DomainError> => err(domainError('INVALID_INPUT', message));

const sameName = (first: string, second: string): boolean =>
  first.toLowerCase() === second.toLowerCase();

function checkDetails(
  draft: AccountDetailsInput,
  others: readonly Account[],
): Result<AccountDetails, DomainError> {
  const name = draft.name.trim();
  if (characters(name) === 0 || characters(name) > NAME_MAX_LENGTH) {
    return invalid(`A name must be 1 to ${String(NAME_MAX_LENGTH)} characters once trimmed.`);
  }

  const description = draft.description.trim();
  if (characters(description) > DESCRIPTION_MAX_LENGTH) {
    return invalid(`A description must be at most ${String(DESCRIPTION_MAX_LENGTH)} characters.`);
  }

  if (draft.activeUntil !== null && draft.activeUntil < draft.activeFrom) {
    return invalid('An Active period cannot end before it starts.');
  }

  if (others.some((other) => sameName(other.name, name))) {
    return err(domainError('NAME_TAKEN', `Another Account is named "${name}".`));
  }

  return ok({
    name,
    description: description === '' ? null : description,
    activeFrom: draft.activeFrom,
    activeUntil: draft.activeUntil,
  });
}

function nextPosition(chart: readonly Account[], accountType: AccountType): number {
  const positions = chart
    .filter((account) => account.accountType === accountType)
    .map((account) => account.position);
  return positions.length === 0 ? 0 : Math.max(...positions) + 1;
}

export function addedAccount(
  chart: readonly Account[],
  accountType: AccountType,
  draft: AccountDetailsInput,
  id: AccountId,
): Result<Account, DomainError> {
  const details = checkDetails(draft, chart);
  if (!details.ok) {
    return details;
  }
  return ok({ id, accountType, position: nextPosition(chart, accountType), ...details.value });
}

export function editedAccount(
  chart: readonly Account[],
  id: AccountId,
  draft: AccountDetailsInput,
): Result<Account, DomainError> {
  const account = chart.find((candidate) => candidate.id === id);
  if (account === undefined) {
    return err(domainError('NOT_FOUND', `Account ${id} is not in the User's chart of accounts.`));
  }

  const details = checkDetails(
    draft,
    chart.filter((other) => other.id !== id),
  );
  return details.ok ? ok({ ...account, ...details.value }) : details;
}
