import {
  domainError,
  err,
  ok,
  type AccountDetailsInput,
  type AccountGroupDetailsInput,
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type DomainError,
  type Err,
  type Result,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from './account';

export const NAME_MAX_LENGTH = 40;
export const DESCRIPTION_MAX_LENGTH = 200;

type Described = {
  readonly name: string;
  readonly description: string | null;
};

type AccountDetails = Pick<Account, 'name' | 'description' | 'activeFrom' | 'activeUntil'>;

type Place = Pick<Account, 'groupId' | 'position'>;

const characters = (text: string): number => Array.from(text).length;

const invalid = (message: string): Err<DomainError> => err(domainError('INVALID_INPUT', message));

const sameName = (first: string, second: string): boolean =>
  first.toLowerCase() === second.toLowerCase();

function checkDescribed(draft: AccountGroupDetailsInput): Result<Described, DomainError> {
  const name = draft.name.trim();
  if (characters(name) === 0 || characters(name) > NAME_MAX_LENGTH) {
    return invalid(`A name must be 1 to ${String(NAME_MAX_LENGTH)} characters once trimmed.`);
  }

  const description = draft.description.trim();
  if (characters(description) > DESCRIPTION_MAX_LENGTH) {
    return invalid(`A description must be at most ${String(DESCRIPTION_MAX_LENGTH)} characters.`);
  }

  return ok({ name, description: description === '' ? null : description });
}

function checkDetails(
  draft: AccountDetailsInput,
  others: readonly Account[],
): Result<AccountDetails, DomainError> {
  const described = checkDescribed(draft);
  if (!described.ok) {
    return described;
  }

  if (draft.activeUntil !== null && draft.activeUntil < draft.activeFrom) {
    return invalid('An Active period cannot end before it starts.');
  }

  const { name } = described.value;
  if (others.some((other) => sameName(other.name, name))) {
    return err(domainError('NAME_TAKEN', `Another Account is named "${name}".`));
  }

  return ok({ ...described.value, activeFrom: draft.activeFrom, activeUntil: draft.activeUntil });
}

function checkGroupDetails(
  draft: AccountGroupDetailsInput,
  accountType: AccountType,
  others: readonly AccountGroup[],
): Result<Described, DomainError> {
  const described = checkDescribed(draft);
  if (!described.ok) {
    return described;
  }

  const { name } = described.value;
  if (others.some((other) => other.accountType === accountType && sameName(other.name, name))) {
    return err(domainError('NAME_TAKEN', `Another Account group of this Account type is named "${name}".`));
  }

  return described;
}

const after = (positions: readonly number[]): number =>
  positions.length === 0 ? 0 : Math.max(...positions) + 1;

function endOfType({ accounts, groups }: Chart, accountType: AccountType): number {
  return after(
    [...accounts.filter((account) => account.groupId === null), ...groups]
      .filter((node) => node.accountType === accountType)
      .map((node) => node.position),
  );
}

function endOfGroup({ accounts }: Chart, groupId: AccountGroupId): number {
  return after(
    accounts.filter((account) => account.groupId === groupId).map((account) => account.position),
  );
}

function placeAtEnd(
  chart: Chart,
  accountType: AccountType,
  groupId: AccountGroupId | null,
): Result<Place, DomainError> {
  if (groupId === null) {
    return ok({ groupId, position: endOfType(chart, accountType) });
  }

  const group = chart.groups.find((candidate) => candidate.id === groupId);
  if (group === undefined) {
    return err(
      domainError('NOT_FOUND', `Account group ${groupId} is not in the User's chart of accounts.`),
    );
  }
  if (group.accountType !== accountType) {
    return invalid('An Account group holds Accounts of its own Account type only.');
  }

  return ok({ groupId, position: endOfGroup(chart, groupId) });
}

export function addedAccount(
  chart: Chart,
  accountType: AccountType,
  draft: AccountDetailsInput,
  id: AccountId,
): Result<Account, DomainError> {
  const details = checkDetails(draft, chart.accounts);
  if (!details.ok) {
    return details;
  }

  const place = placeAtEnd(chart, accountType, draft.groupId);
  return place.ok ? ok({ id, accountType, ...place.value, ...details.value }) : place;
}

export function editedAccount(
  chart: Chart,
  id: AccountId,
  draft: AccountDetailsInput,
): Result<Account, DomainError> {
  const account = chart.accounts.find((candidate) => candidate.id === id);
  if (account === undefined) {
    return err(domainError('NOT_FOUND', `Account ${id} is not in the User's chart of accounts.`));
  }

  const details = checkDetails(
    draft,
    chart.accounts.filter((other) => other.id !== id),
  );
  if (!details.ok) {
    return details;
  }

  if (draft.groupId === account.groupId) {
    return ok({ ...account, ...details.value });
  }

  const place = placeAtEnd(chart, account.accountType, draft.groupId);
  return place.ok ? ok({ ...account, ...details.value, ...place.value }) : place;
}

export function addedGroup(
  chart: Chart,
  accountType: AccountType,
  draft: AccountGroupDetailsInput,
  id: AccountGroupId,
): Result<AccountGroup, DomainError> {
  const details = checkGroupDetails(draft, accountType, chart.groups);
  return details.ok
    ? ok({ id, accountType, position: endOfType(chart, accountType), ...details.value })
    : details;
}

export function editedGroup(
  chart: Chart,
  id: AccountGroupId,
  draft: AccountGroupDetailsInput,
): Result<AccountGroup, DomainError> {
  const group = chart.groups.find((candidate) => candidate.id === id);
  if (group === undefined) {
    return err(
      domainError('NOT_FOUND', `Account group ${id} is not in the User's chart of accounts.`),
    );
  }

  const details = checkGroupDetails(
    draft,
    group.accountType,
    chart.groups.filter((other) => other.id !== id),
  );
  return details.ok ? ok({ ...group, ...details.value }) : details;
}
