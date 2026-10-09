import { describe, expect, it } from 'vitest';
import {
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type MoveChartNodeInput,
  type Result,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from './account';
import { movedNode } from './move';

const idOf = (n: number): string => `01920000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const account = (
  n: number,
  accountType: Account['accountType'],
  position: number,
  name: string,
  groupId: AccountGroupId | null = null,
): Account => ({
  id: idOf(n) as AccountId,
  accountType,
  groupId,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const group = (
  n: number,
  accountType: AccountGroup['accountType'],
  position: number,
  name: string,
): AccountGroup => ({ id: idOf(n) as AccountGroupId, accountType, name, description: null, position });

const BANK = group(50, 'asset', 4, 'Bank');
const SAVINGS = group(51, 'asset', 9, 'Savings');
const TRAVEL = group(52, 'expense', 0, 'Travel');
const CASH = account(1, 'asset', 2, 'Cash');
const WALLET = account(2, 'asset', 7, 'Wallet');
const ABC_BANK = account(3, 'asset', 3, 'ABC Bank', BANK.id);
const XYZ_BANK = account(4, 'asset', 8, 'XYZ Bank', BANK.id);
const EXPENSES = account(5, 'expense', 1, 'Expenses');
const HOTELS = account(6, 'expense', 0, 'Hotels', TRAVEL.id);

const CHART: Chart = {
  accounts: [WALLET, XYZ_BANK, CASH, ABC_BANK, EXPENSES, HOTELS],
  groups: [SAVINGS, BANK, TRAVEL],
};

const moveAccount = (
  moving: Account,
  index: number,
  groupId: AccountGroupId | null = null,
  accountType: Account['accountType'] = moving.accountType,
): MoveChartNodeInput => ({ node: { kind: 'account', id: moving.id }, accountType, groupId, index });

const moveGroup = (
  moving: AccountGroup,
  index: number,
  groupId: AccountGroupId | null = null,
  accountType: AccountGroup['accountType'] = moving.accountType,
): MoveChartNodeInput => ({ node: { kind: 'group', id: moving.id }, accountType, groupId, index });

const refusal = (result: Result<unknown, DomainError>): string =>
  result.ok ? 'accepted' : `${result.error.code}: ${result.error.message}`;

describe('movedNode', () => {
  it("reorders an Account within its Account type's list, numbering every node of that list from nought", () => {
    expect(movedNode(CHART, moveAccount(WALLET, 0))).toEqual({
      ok: true,
      value: {
        accounts: [
          { ...WALLET, position: 0 },
          { ...CASH, position: 1 },
        ],
        groups: [
          { ...BANK, position: 2 },
          { ...SAVINGS, position: 3 },
        ],
      },
    });
  });

  it('places a node at the end of its list when given the place after the last of the others', () => {
    expect(movedNode(CHART, moveAccount(CASH, 3))).toEqual({
      ok: true,
      value: {
        accounts: [
          { ...WALLET, position: 1 },
          { ...CASH, position: 3 },
        ],
        groups: [
          { ...BANK, position: 0 },
          { ...SAVINGS, position: 2 },
        ],
      },
    });
  });

  it('reorders an Account group among the Account groups and Accounts of its Account type', () => {
    expect(movedNode(CHART, moveGroup(SAVINGS, 1))).toEqual({
      ok: true,
      value: {
        accounts: [
          { ...CASH, position: 0 },
          { ...WALLET, position: 3 },
        ],
        groups: [
          { ...SAVINGS, position: 1 },
          { ...BANK, position: 2 },
        ],
      },
    });
  });

  it('reorders an Account within its Account group, leaving every other list as it was', () => {
    expect(movedNode(CHART, moveAccount(XYZ_BANK, 0, BANK.id))).toEqual({
      ok: true,
      value: {
        accounts: [
          { ...XYZ_BANK, position: 0 },
          { ...ABC_BANK, position: 1 },
        ],
        groups: [],
      },
    });
  });

  it('moves an Account into an Account group of its Account type, at the place it is given', () => {
    expect(movedNode(CHART, moveAccount(CASH, 1, BANK.id))).toEqual({
      ok: true,
      value: {
        accounts: [
          { ...ABC_BANK, position: 0 },
          { ...CASH, groupId: BANK.id, position: 1 },
          { ...XYZ_BANK, position: 2 },
        ],
        groups: [],
      },
    });
  });

  it('moves an Account into an empty Account group', () => {
    expect(movedNode(CHART, moveAccount(CASH, 0, SAVINGS.id))).toEqual({
      ok: true,
      value: { accounts: [{ ...CASH, groupId: SAVINGS.id, position: 0 }], groups: [] },
    });
  });

  it("moves an Account out of its Account group, into its Account type's list", () => {
    expect(movedNode(CHART, moveAccount(ABC_BANK, 0))).toEqual({
      ok: true,
      value: {
        accounts: [
          { ...ABC_BANK, groupId: null, position: 0 },
          { ...CASH, position: 1 },
          { ...WALLET, position: 3 },
        ],
        groups: [
          { ...BANK, position: 2 },
          { ...SAVINGS, position: 4 },
        ],
      },
    });
  });

  it('moves an Account between Account groups of its Account type', () => {
    expect(movedNode(CHART, moveAccount(XYZ_BANK, 0, SAVINGS.id))).toEqual({
      ok: true,
      value: { accounts: [{ ...XYZ_BANK, groupId: SAVINGS.id, position: 0 }], groups: [] },
    });
  });

  it('refuses a place past the end of the list as invalid', () => {
    expect(refusal(movedNode(CHART, moveAccount(CASH, 4)))).toBe(
      'INVALID_INPUT: A list of 3 others has no place 4.',
    );
    expect(refusal(movedNode(CHART, moveAccount(CASH, 3, BANK.id)))).toBe(
      'INVALID_INPUT: A list of 2 others has no place 3.',
    );
  });

  it('refuses to place an Account group in an Account group', () => {
    expect(refusal(movedNode(CHART, moveGroup(SAVINGS, 0, BANK.id)))).toBe(
      'INVALID_INPUT: An Account group cannot be placed in an Account group.',
    );
  });

  it('refuses to move an Account or an Account group to another Account type', () => {
    expect(refusal(movedNode(CHART, moveAccount(CASH, 0, null, 'expense')))).toBe(
      'INVALID_INPUT: Nothing moves to another Account type.',
    );
    expect(refusal(movedNode(CHART, moveGroup(BANK, 0, null, 'expense')))).toBe(
      'INVALID_INPUT: Nothing moves to another Account type.',
    );
  });

  it('refuses to move an Account into an Account group of another Account type', () => {
    expect(refusal(movedNode(CHART, moveAccount(CASH, 0, TRAVEL.id)))).toBe(
      'INVALID_INPUT: An Account group holds Accounts of its own Account type only.',
    );
  });

  it("refuses a node or an Account group missing from the User's chart as not found", () => {
    const stranger = account(90, 'asset', 0, 'Stranger');
    const strangers = group(91, 'asset', 0, 'Strangers');

    expect(refusal(movedNode(CHART, moveAccount(stranger, 0)))).toBe(
      `NOT_FOUND: Account ${stranger.id} is not in the User's chart of accounts.`,
    );
    expect(refusal(movedNode(CHART, moveGroup(strangers, 0)))).toBe(
      `NOT_FOUND: Account group ${strangers.id} is not in the User's chart of accounts.`,
    );
    expect(refusal(movedNode(CHART, moveAccount(CASH, 0, strangers.id)))).toBe(
      `NOT_FOUND: Account group ${strangers.id} is not in the User's chart of accounts.`,
    );
  });
});
