import type { AccountGroupId, AccountId } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import {
  branchesOf,
  nameContains,
  ruledRunsOf,
  runsOf,
  shownInSection,
  type Run,
} from './chart-tree';

const id = (tail: string): string => `01920000-0000-7000-8000-${tail.padStart(12, '0')}`;

const BANK = id('b001') as AccountGroupId;

const account = (tail: string, name: string, activeUntil: string | null = null) => ({
  id: id(tail) as AccountId,
  accountType: 'asset' as const,
  groupId: BANK,
  name,
  description: null,
  activeFrom: '2026-01-01',
  activeUntil,
});

const CHECKING = account('c001', 'Checking');
const SAVINGS = account('c002', 'Savings');
const OLD_SAVINGS = account('c003', 'Old savings', '2026-06-30');
const IN_BANK = [CHECKING, SAVINGS, OLD_SAVINGS];

describe('branchesOf', () => {
  it('draws a tee before every shown Account but the last, and an elbow before the last', () => {
    expect(branchesOf(IN_BANK, () => true)).toEqual(
      new Map([
        [CHECKING.id, 'tee'],
        [SAVINGS.id, 'tee'],
        [OLD_SAVINGS.id, 'elbow'],
      ]),
    );
  });

  it('ends the tree at the last Account still shown when the ended one after it is hidden', () => {
    const shown = shownInSection({ showEnded: false, today: '2026-10-10' });

    expect(branchesOf(IN_BANK, shown)).toEqual(
      new Map([
        [CHECKING.id, 'tee'],
        [SAVINGS.id, 'elbow'],
      ]),
    );
  });

  it('keeps the ended Account last in the tree while ended Accounts are shown', () => {
    const shown = shownInSection({ showEnded: true, today: '2026-10-10' });

    expect(branchesOf(IN_BANK, shown).get(OLD_SAVINGS.id)).toBe('elbow');
  });

  it('ends the tree at the last Account that Find an account still matches', () => {
    expect(branchesOf(IN_BANK, nameContains(' check '))).toEqual(
      new Map([[CHECKING.id, 'elbow']]),
    );
    expect(branchesOf(IN_BANK, nameContains('SAV'))).toEqual(
      new Map([
        [SAVINGS.id, 'tee'],
        [OLD_SAVINGS.id, 'elbow'],
      ]),
    );
  });

  it('draws nothing for a group with no Account shown', () => {
    expect(branchesOf(IN_BANK, nameContains('cash')).size).toBe(0);
  });
});

describe('shownInSection', () => {
  it('hides an Account that has ended by today unless ended Accounts are shown', () => {
    expect(shownInSection({ showEnded: false, today: '2026-10-10' })(OLD_SAVINGS)).toBe(false);
    expect(shownInSection({ showEnded: false, today: '2026-06-30' })(OLD_SAVINGS)).toBe(true);
    expect(shownInSection({ showEnded: true, today: '2026-10-10' })(OLD_SAVINGS)).toBe(true);
  });

  it('hides any Account with an end day until today is known', () => {
    expect(shownInSection({ showEnded: false, today: undefined })(OLD_SAVINGS)).toBe(false);
    expect(shownInSection({ showEnded: false, today: undefined })(SAVINGS)).toBe(true);
  });
});

const group = (
  tail: string,
  name: string,
  accounts: readonly ReturnType<typeof account>[],
): Run => ({
  kind: 'group',
  group: {
    id: id(tail) as AccountGroupId,
    accountType: 'asset',
    name,
    description: null,
  },
  accounts,
});

const ungrouped = (...accounts: readonly ReturnType<typeof account>[]): Run => ({
  kind: 'accounts',
  accounts,
});

const CASH = ungrouped(account('d001', 'Cash'));
const RECEIVABLE = ungrouped(account('d002', 'Receivable'));
const BANK_RUN = group('b001', 'Bank', IN_BANK);
const CARDS = group('b002', 'Cards', [account('e001', 'Visa')]);
const PETTY = group('b003', 'Petty', [account('e002', 'Float')]);

const rulesOf = (runs: readonly Run[], shown: Parameters<typeof ruledRunsOf>[1]) =>
  ruledRunsOf(runs, shown).map(({ rules }) => rules);

describe('ruledRunsOf', () => {
  it('keeps every run in order', () => {
    expect(ruledRunsOf([CASH, BANK_RUN], () => false).map(({ run }) => run)).toEqual([
      CASH,
      BANK_RUN,
    ]);
  });

  it('bounds a group between ungrouped Accounts above and below, and leaves the ungrouped unruled', () => {
    expect(rulesOf([CASH, BANK_RUN, RECEIVABLE], () => true)).toEqual([
      { above: false, below: false },
      { above: true, below: true },
      { above: false, below: false },
    ]);
  });

  it('lets two groups that meet share one rule', () => {
    expect(rulesOf([CASH, CARDS, PETTY, RECEIVABLE], () => true)).toEqual([
      { above: false, below: false },
      { above: true, below: true },
      { above: false, below: true },
      { above: false, below: false },
    ]);
  });

  it('gives a group its own rule above when the group before it has no Account shown', () => {
    expect(
      rulesOf([CASH, CARDS, PETTY, RECEIVABLE], (shown) => shown.name !== 'Visa')[2],
    ).toEqual({ above: true, below: true });
  });

  it('lets groups meet across ungrouped Accounts that are not shown', () => {
    expect(
      rulesOf([RECEIVABLE, CARDS, CASH, PETTY, RECEIVABLE], (shown) => shown.name !== 'Cash')[3],
    ).toEqual({ above: false, below: true });
  });

  it('draws no rule for a group that is the only run of its type', () => {
    expect(rulesOf([BANK_RUN], () => true)).toEqual([{ above: false, below: false }]);
  });

  it('draws no rule above a group first in its type', () => {
    expect(rulesOf([CARDS, CASH], () => true)[0]).toEqual({ above: false, below: true });
  });

  it('draws no rule below a group last in its type', () => {
    expect(rulesOf([CASH, CARDS], () => true)[1]).toEqual({ above: true, below: false });
  });

  it('keeps only the shared rule between two groups that make up their type', () => {
    expect(rulesOf([CARDS, PETTY], () => true)).toEqual([
      { above: false, below: true },
      { above: false, below: false },
    ]);
  });

  it('draws no rule above a group that a search leaves first in its type', () => {
    expect(rulesOf([CASH, CARDS, RECEIVABLE], (shown) => shown.name !== 'Cash')[1]).toEqual({
      above: false,
      below: true,
    });
  });

  it('draws no rule below a group that a search leaves last in its type', () => {
    expect(rulesOf([CASH, CARDS, RECEIVABLE], (shown) => shown.name !== 'Receivable')[1]).toEqual(
      { above: true, below: false },
    );
  });

  it('draws no rule above a group when the group before it is first in its type and has no Account shown', () => {
    expect(rulesOf([CARDS, PETTY, CASH], (shown) => shown.name !== 'Visa')[1]).toEqual({
      above: false,
      below: true,
    });
  });
});

describe('runsOf', () => {
  it('joins neighbouring ungrouped Accounts of a type into one run, keeps each group a run of its own, and leaves other types out', () => {
    const cash = account('f001', 'Cash');
    const petty = account('f002', 'Petty cash');
    const loan = { ...account('f003', 'Loan'), accountType: 'liability' as const };
    const receivable = account('f004', 'Receivable');
    const bank = {
      id: BANK,
      accountType: 'asset' as const,
      name: 'Bank',
      description: null,
    };

    expect(
      runsOf(
        [
          { kind: 'account', account: cash },
          { kind: 'account', account: petty },
          { kind: 'account', account: loan },
          { kind: 'group', group: bank, accounts: [...IN_BANK] },
          { kind: 'account', account: receivable },
        ],
        'asset',
      ),
    ).toEqual([
      { kind: 'accounts', accounts: [cash, petty] },
      { kind: 'group', group: bank, accounts: IN_BANK },
      { kind: 'accounts', accounts: [receivable] },
    ]);
  });
});
