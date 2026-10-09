import { describe, expect, it } from 'vitest';
import {
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from './account';
import { removedAccount, removedGroup } from './removal';

const BANK: AccountGroup = {
  id: '01920000-0000-7000-8000-000000000b01' as AccountGroupId,
  accountType: 'asset',
  name: 'Bank',
  description: null,
  position: 1,
};

const LOANS: AccountGroup = {
  id: '01920000-0000-7000-8000-000000000b02' as AccountGroupId,
  accountType: 'liability',
  name: 'Loans',
  description: null,
  position: 0,
};

const CASH: Account = {
  id: '01920000-0000-7000-8000-000000000001' as AccountId,
  accountType: 'asset',
  groupId: null,
  name: 'Cash',
  description: null,
  position: 0,
  activeFrom: '2026-09-01',
  activeUntil: null,
};

const ABC_BANK: Account = {
  ...CASH,
  id: '01920000-0000-7000-8000-000000000002' as AccountId,
  groupId: BANK.id,
  name: 'ABC Bank',
};

const CHART: Chart = { accounts: [CASH, ABC_BANK], groups: [BANK, LOANS] };

const ABSENT_ACCOUNT = '01920000-0000-7000-8000-000000000099' as AccountId;
const ABSENT_GROUP = '01920000-0000-7000-8000-000000000b99' as AccountGroupId;

const refusal = (result: Result<unknown, DomainError>): string =>
  result.ok ? 'accepted' : `${result.error.code}: ${result.error.message}`;

describe('removedAccount', () => {
  it('removes an Account no Entry line names, answering with it', () => {
    expect(removedAccount(CHART, CASH.id, false)).toEqual({ ok: true, value: CASH });
    expect(removedAccount(CHART, ABC_BANK.id, false)).toEqual({ ok: true, value: ABC_BANK });
  });

  it('refuses an Account an Entry line names as in use, telling the User to end it instead', () => {
    expect(refusal(removedAccount(CHART, CASH.id, true))).toBe(
      'IN_USE: An Entry names Account "Cash", a deleted or edited Entry included, so it cannot be deleted; give it an end day instead.',
    );
  });

  it("refuses an Account outside the User's chart as not found, named or not", () => {
    const expected = `NOT_FOUND: Account ${ABSENT_ACCOUNT} is not in the User's chart of accounts.`;

    expect(refusal(removedAccount(CHART, ABSENT_ACCOUNT, false))).toBe(expected);
    expect(refusal(removedAccount(CHART, ABSENT_ACCOUNT, true))).toBe(expected);
  });
});

describe('removedGroup', () => {
  it('removes an Account group that holds no Account, answering with it', () => {
    expect(removedGroup(CHART, LOANS.id)).toEqual({ ok: true, value: LOANS });
  });

  it('refuses an Account group that holds an Account as in use', () => {
    expect(refusal(removedGroup(CHART, BANK.id))).toBe(
      'IN_USE: Account group "Bank" holds Accounts, so it cannot be deleted until it is empty.',
    );
  });

  it('removes an Account group once its last Account has left it', () => {
    const emptied: Chart = { ...CHART, accounts: [CASH, { ...ABC_BANK, groupId: null }] };

    expect(removedGroup(emptied, BANK.id)).toEqual({ ok: true, value: BANK });
  });

  it("refuses an Account group outside the User's chart as not found", () => {
    expect(refusal(removedGroup(CHART, ABSENT_GROUP))).toBe(
      `NOT_FOUND: Account group ${ABSENT_GROUP} is not in the User's chart of accounts.`,
    );
  });
});
