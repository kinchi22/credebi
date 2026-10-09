import { describe, expect, it } from 'vitest';
import {
  type AccountDetailsInput,
  type AccountGroupDetailsInput,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from './account';
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  addedAccount,
  addedGroup,
  editedAccount,
  editedGroup,
} from './account-details';

const idOf = (n: number): AccountId =>
  `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountId;

const account = (
  n: number,
  accountType: Account['accountType'],
  position: number,
  name: string,
): Account => ({
  id: idOf(n),
  accountType,
  groupId: null,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const CASH = account(1, 'asset', 0, 'Cash');
const SAFE = account(2, 'asset', 5, 'Safe');
const EXPENSES = account(3, 'expense', 9, 'Expenses');
const groupIdOf = (n: number): AccountGroupId =>
  `01920000-0000-7000-8000-${String(n).padStart(12, '0')}` as AccountGroupId;

const group = (
  n: number,
  accountType: AccountGroup['accountType'],
  position: number,
  name: string,
): AccountGroup => ({ id: groupIdOf(n), accountType, name, description: null, position });

const BANK = group(50, 'asset', 7, 'Bank');
const TRAVEL = group(51, 'expense', 2, 'Travel');
const ABC_BANK: Account = { ...account(4, 'asset', 4, 'ABC Bank'), groupId: BANK.id };
const HOTELS: Account = { ...account(5, 'expense', 11, 'Hotels'), groupId: TRAVEL.id };

const CHART: Chart = {
  accounts: [CASH, SAFE, EXPENSES, ABC_BANK, HOTELS],
  groups: [BANK, TRAVEL],
};

const chartOf = (...accounts: Account[]): Chart => ({ accounts, groups: [] });

const NEW_ID = idOf(100);

const draft = (fields: Partial<AccountDetailsInput> = {}): AccountDetailsInput => ({
  name: 'Wallet',
  description: '',
  groupId: null,
  activeFrom: '2026-10-09',
  activeUntil: null,
  ...fields,
});

const refusal = (result: Result<unknown, DomainError>): string =>
  result.ok ? 'accepted' : `${result.error.code}: ${result.error.message}`;

describe('addedAccount', () => {
  it('makes an Account of the Account type, with the id it is given and the details it was given', () => {
    expect(
      addedAccount(CHART, 'expense', draft({ description: 'Cash I carry', activeUntil: '2026-12-31' }), NEW_ID),
    ).toEqual({
      ok: true,
      value: {
        id: NEW_ID,
        accountType: 'expense',
        groupId: null,
        name: 'Wallet',
        description: 'Cash I carry',
        position: 10,
        activeFrom: '2026-10-09',
        activeUntil: '2026-12-31',
      },
    });
  });

  it('places a new ungrouped Account after the last Account or Account group of its Account type, whatever the others hold', () => {
    const afterGroup = addedAccount(CHART, 'asset', draft(), NEW_ID);
    const afterAccount = addedAccount(CHART, 'expense', draft(), NEW_ID);

    expect(afterGroup.ok && afterGroup.value.position).toBe(8);
    expect(afterAccount.ok && afterAccount.value.position).toBe(10);
  });

  it('places a new Account of an Account group after the last Account of that group', () => {
    const added = addedAccount(CHART, 'asset', draft({ groupId: BANK.id }), NEW_ID);

    expect(added).toEqual({
      ok: true,
      value: expect.objectContaining({ groupId: BANK.id, position: 5 }) as unknown,
    });
  });

  it('places the first Account of an Account group first in it', () => {
    const added = addedAccount(
      { ...CHART, groups: [...CHART.groups, group(52, 'asset', 9, 'Savings')] },
      'asset',
      draft({ groupId: groupIdOf(52) }),
      NEW_ID,
    );

    expect(added.ok && added.value.position).toBe(0);
  });

  it('refuses an Account group of another Account type', () => {
    expect(refusal(addedAccount(CHART, 'asset', draft({ groupId: TRAVEL.id }), NEW_ID))).toBe(
      'INVALID_INPUT: An Account group holds Accounts of its own Account type only.',
    );
  });

  it("refuses an Account group that is not in the User's chart as not found", () => {
    expect(refusal(addedAccount(CHART, 'asset', draft({ groupId: groupIdOf(99) }), NEW_ID))).toMatch(
      /^NOT_FOUND: Account group .+ is not in the User's chart of accounts/,
    );
  });

  it('places the first Account of an Account type first', () => {
    const added = addedAccount(CHART, 'liability', draft(), NEW_ID);

    expect(added.ok && added.value.position).toBe(0);
  });

  it('trims the name and the description, and keeps an empty description as none', () => {
    const added = addedAccount(CHART, 'asset', draft({ name: '  Wallet ', description: '   ' }), NEW_ID);
    const described = addedAccount(CHART, 'asset', draft({ description: ' Notes  ' }), NEW_ID);

    expect(added.ok && added.value.name).toBe('Wallet');
    expect(added.ok && added.value.description).toBeNull();
    expect(described.ok && described.value.description).toBe('Notes');
  });

  it(`takes a name of 1 to ${String(NAME_MAX_LENGTH)} characters once trimmed, counting each emoji as one`, () => {
    for (const name of ['W', 'w'.repeat(NAME_MAX_LENGTH), `  ${'w'.repeat(NAME_MAX_LENGTH)}  `, '\u{1F4B0}'.repeat(NAME_MAX_LENGTH)]) {
      expect(addedAccount(CHART, 'asset', draft({ name }), NEW_ID).ok).toBe(true);
    }
  });

  it('refuses an empty name, a blank one and one too long', () => {
    for (const name of ['', '   ', 'w'.repeat(NAME_MAX_LENGTH + 1), '\u{1F4B0}'.repeat(NAME_MAX_LENGTH + 1)]) {
      expect(refusal(addedAccount(CHART, 'asset', draft({ name }), NEW_ID))).toMatch(/^INVALID_INPUT: A name must be 1 to 40 characters/);
    }
  });

  it(`takes a description of up to ${String(DESCRIPTION_MAX_LENGTH)} characters, and refuses a longer one`, () => {
    const longest = 'd'.repeat(DESCRIPTION_MAX_LENGTH);

    expect(addedAccount(CHART, 'asset', draft({ description: longest }), NEW_ID).ok).toBe(true);
    expect(addedAccount(CHART, 'asset', draft({ description: ` ${longest} ` }), NEW_ID).ok).toBe(true);
    expect(
      refusal(addedAccount(CHART, 'asset', draft({ description: `${longest}d` }), NEW_ID)),
    ).toMatch(/^INVALID_INPUT: A description must be at most 200 characters/);
  });

  it('takes an Active period of one day, or with no end, and refuses one that ends before it starts', () => {
    expect(addedAccount(CHART, 'asset', draft({ activeUntil: '2026-10-09' }), NEW_ID).ok).toBe(true);
    expect(addedAccount(CHART, 'asset', draft({ activeUntil: null }), NEW_ID).ok).toBe(true);
    expect(
      refusal(addedAccount(CHART, 'asset', draft({ activeUntil: '2026-10-08' }), NEW_ID)),
    ).toMatch(/^INVALID_INPUT: An Active period cannot end before it starts/);
  });

  it("refuses a name another of the User's Accounts has, ignoring case and surrounding space, under any Account type", () => {
    for (const name of ['Cash', 'CASH', ' cash ', 'expenses']) {
      expect(refusal(addedAccount(CHART, 'asset', draft({ name }), NEW_ID))).toMatch(/^NAME_TAKEN: Another Account is named "\w+"/);
    }
  });

  it('checks the name rules before whether a name is taken', () => {
    expect(
      refusal(addedAccount(CHART, 'asset', draft({ name: 'Cash', activeUntil: '2026-01-01' }), NEW_ID)),
    ).toMatch(/^INVALID_INPUT: An Active period cannot end/);
  });
});

describe('editedAccount', () => {
  it('changes the name, description and Active period, and keeps the id, Account type and place', () => {
    expect(
      editedAccount(
        CHART,
        SAFE.id,
        draft({ name: ' Vault ', description: 'At home', activeFrom: '2026-01-01', activeUntil: '2026-12-31' }),
      ),
    ).toEqual({
      ok: true,
      value: {
        ...SAFE,
        name: 'Vault',
        description: 'At home',
        activeFrom: '2026-01-01',
        activeUntil: '2026-12-31',
      },
    });
  });

  it('keeps an Account its own name, in another case too', () => {
    const edited = editedAccount(CHART, CASH.id, draft({ name: 'CASH' }));

    expect(edited.ok && edited.value.name).toBe('CASH');
  });

  it('removes a description by emptying it', () => {
    const described = { ...CASH, description: 'Notes' };

    const edited = editedAccount(chartOf(described), CASH.id, draft({ name: 'Cash', description: '' }));

    expect(edited.ok && edited.value.description).toBeNull();
  });

  it("refuses a name another of the User's Accounts has, ignoring case", () => {
    expect(refusal(editedAccount(CHART, CASH.id, draft({ name: 'expenses' })))).toBe('NAME_TAKEN: Another Account is named "expenses".');
  });

  it('holds an edit to the same rules as an addition', () => {
    expect(refusal(editedAccount(CHART, CASH.id, draft({ name: ' ' })))).toMatch(/^INVALID_INPUT: A name must be 1 to 40 characters/);
    expect(
      refusal(editedAccount(CHART, CASH.id, draft({ activeFrom: '2026-10-09', activeUntil: '2026-10-01' }))),
    ).toMatch(/^INVALID_INPUT: An Active period cannot end before it starts/);
  });

  it("refuses an Account that is not in the User's chart as not found", () => {
    expect(refusal(editedAccount(CHART, NEW_ID, draft()))).toMatch(/^NOT_FOUND: Account .+ is not in the User's chart of accounts/);
  });

  it('keeps the place of an Account that stays in its Account group', () => {
    const edited = editedAccount(CHART, ABC_BANK.id, draft({ name: 'ABC', groupId: BANK.id }));

    expect(edited).toEqual({ ok: true, value: { ...ABC_BANK, name: 'ABC', activeFrom: '2026-10-09' } });
  });

  it('moves an Account into an Account group, last in it', () => {
    const edited = editedAccount(CHART, SAFE.id, draft({ name: 'Safe', groupId: BANK.id }));

    expect(edited.ok && [edited.value.groupId, edited.value.position]).toEqual([BANK.id, 5]);
  });

  it('moves an Account out of its Account group, last among the Account groups and Accounts of its Account type', () => {
    const edited = editedAccount(CHART, ABC_BANK.id, draft({ name: 'ABC Bank' }));

    expect(edited.ok && [edited.value.groupId, edited.value.position]).toEqual([null, 8]);
  });

  it('moves an Account between Account groups of its Account type, last in the new one', () => {
    const savings = group(52, 'asset', 9, 'Savings');
    const chart = { ...CHART, groups: [...CHART.groups, savings] };

    const edited = editedAccount(chart, ABC_BANK.id, draft({ name: 'ABC Bank', groupId: savings.id }));

    expect(edited.ok && [edited.value.groupId, edited.value.position]).toEqual([savings.id, 0]);
  });

  it('refuses to move an Account into an Account group of another Account type, or one not in the chart', () => {
    expect(refusal(editedAccount(CHART, CASH.id, draft({ name: 'Cash', groupId: TRAVEL.id })))).toBe(
      'INVALID_INPUT: An Account group holds Accounts of its own Account type only.',
    );
    expect(refusal(editedAccount(CHART, CASH.id, draft({ name: 'Cash', groupId: groupIdOf(99) })))).toMatch(
      /^NOT_FOUND: Account group/,
    );
  });
});

const groupDraft = (fields: Partial<AccountGroupDetailsInput> = {}): AccountGroupDetailsInput => ({
  name: 'Savings',
  description: '',
  ...fields,
});

const NEW_GROUP_ID = groupIdOf(100);

describe('addedGroup', () => {
  it('makes an Account group of the Account type, with the id it is given and the details it was given, last in its Account type', () => {
    expect(addedGroup(CHART, 'asset', groupDraft({ name: ' Savings ', description: ' Put aside ' }), NEW_GROUP_ID)).toEqual({
      ok: true,
      value: {
        id: NEW_GROUP_ID,
        accountType: 'asset',
        name: 'Savings',
        description: 'Put aside',
        position: 8,
      },
    });
  });

  it('places a new Account group after the last ungrouped Account of its Account type, and first in an empty one', () => {
    const afterAccount = addedGroup(CHART, 'expense', groupDraft(), NEW_GROUP_ID);
    const first = addedGroup(CHART, 'equity', groupDraft(), NEW_GROUP_ID);

    expect(afterAccount.ok && afterAccount.value.position).toBe(10);
    expect(first.ok && first.value.position).toBe(0);
  });

  it('keeps an empty description as none', () => {
    const added = addedGroup(CHART, 'asset', groupDraft({ description: '  ' }), NEW_GROUP_ID);

    expect(added.ok && added.value.description).toBeNull();
  });

  it('holds an Account group name and description to the rules of an Account', () => {
    for (const name of ['', '  ', 'g'.repeat(NAME_MAX_LENGTH + 1)]) {
      expect(refusal(addedGroup(CHART, 'asset', groupDraft({ name }), NEW_GROUP_ID))).toMatch(/^INVALID_INPUT: A name must be 1 to 40 characters/);
    }
    expect(addedGroup(CHART, 'asset', groupDraft({ name: 'g'.repeat(NAME_MAX_LENGTH) }), NEW_GROUP_ID).ok).toBe(true);
    expect(
      refusal(addedGroup(CHART, 'asset', groupDraft({ description: 'd'.repeat(DESCRIPTION_MAX_LENGTH + 1) }), NEW_GROUP_ID)),
    ).toMatch(/^INVALID_INPUT: A description must be at most 200 characters/);
  });

  it('refuses a name another Account group of its Account type has, ignoring case', () => {
    for (const name of ['Bank', ' BANK ']) {
      expect(refusal(addedGroup(CHART, 'asset', groupDraft({ name }), NEW_GROUP_ID))).toMatch(
        /^NAME_TAKEN: Another Account group of this Account type is named "\w+"/,
      );
    }
  });

  it('takes a name an Account group of another Account type has, or an Account has', () => {
    expect(addedGroup(CHART, 'liability', groupDraft({ name: 'bank' }), NEW_GROUP_ID).ok).toBe(true);
    expect(addedGroup(CHART, 'asset', groupDraft({ name: 'Cash' }), NEW_GROUP_ID).ok).toBe(true);
  });
});

describe('editedGroup', () => {
  it('changes the name and description, and keeps the id, Account type and place', () => {
    expect(editedGroup(CHART, BANK.id, groupDraft({ name: ' Banks ', description: 'Current accounts' }))).toEqual({
      ok: true,
      value: { ...BANK, name: 'Banks', description: 'Current accounts' },
    });
  });

  it('keeps an Account group its own name, in another case too', () => {
    const edited = editedGroup(CHART, BANK.id, groupDraft({ name: 'BANK' }));

    expect(edited.ok && edited.value.name).toBe('BANK');
  });

  it('refuses a name another Account group of its Account type has, and takes one of another Account type', () => {
    const chart = { ...CHART, groups: [...CHART.groups, group(52, 'asset', 9, 'Savings')] };

    expect(refusal(editedGroup(chart, BANK.id, groupDraft({ name: 'savings' })))).toBe(
      'NAME_TAKEN: Another Account group of this Account type is named "savings".',
    );
    expect(editedGroup(chart, BANK.id, groupDraft({ name: 'Travel' })).ok).toBe(true);
  });

  it('holds an edit to the same rules as an addition', () => {
    expect(refusal(editedGroup(CHART, BANK.id, groupDraft({ name: ' ' })))).toMatch(/^INVALID_INPUT: A name must be/);
  });

  it("refuses an Account group that is not in the User's chart as not found", () => {
    expect(refusal(editedGroup(CHART, NEW_GROUP_ID, groupDraft()))).toMatch(
      /^NOT_FOUND: Account group .+ is not in the User's chart of accounts/,
    );
  });
});
