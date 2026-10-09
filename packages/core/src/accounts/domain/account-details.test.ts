import { describe, expect, it } from 'vitest';
import {
  type AccountDetailsInput,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type Account } from './account';
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  addedAccount,
  editedAccount,
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
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const CASH = account(1, 'asset', 0, 'Cash');
const SAFE = account(2, 'asset', 5, 'Safe');
const EXPENSES = account(3, 'expense', 9, 'Expenses');
const CHART = [CASH, SAFE, EXPENSES];

const NEW_ID = idOf(100);

const draft = (fields: Partial<AccountDetailsInput> = {}): AccountDetailsInput => ({
  name: 'Wallet',
  description: '',
  activeFrom: '2026-10-09',
  activeUntil: null,
  ...fields,
});

const refusal = (result: Result<Account, DomainError>): string =>
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
        name: 'Wallet',
        description: 'Cash I carry',
        position: 10,
        activeFrom: '2026-10-09',
        activeUntil: '2026-12-31',
      },
    });
  });

  it('places a new Account after the last of its Account type, whatever the others hold', () => {
    const added = addedAccount(CHART, 'asset', draft(), NEW_ID);

    expect(added.ok && added.value.position).toBe(6);
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

    const edited = editedAccount([described], CASH.id, draft({ name: 'Cash', description: '' }));

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
});
