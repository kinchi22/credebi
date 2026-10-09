import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type MoveChartNodeInput,
  type UserId,
} from '@repo/contracts';
import { SIGNED_OUT, type AuthContext } from '../../auth/domain/auth-context';
import { type Account, type AccountGroup } from '../domain/account';
import { createGetChart } from './get-chart';
import { inMemoryAccounts } from './in-memory-accounts';
import { createMoveChartNode } from './move-chart-node';

const ADA_ID = '01920000-0000-7000-8000-0000000000a1' as UserId;
const GRACE_ID = '01920000-0000-7000-8000-0000000000a2' as UserId;
const ADA: AuthContext = { userId: ADA_ID };
const GRACE: AuthContext = { userId: GRACE_ID };

const idOf = (n: number): string => `01920000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const account = (
  n: number,
  name: string,
  position: number,
  groupId: AccountGroupId | null = null,
): Account => ({
  id: idOf(n) as AccountId,
  accountType: 'asset',
  groupId,
  name,
  description: null,
  position,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const group = (n: number, name: string, position: number): AccountGroup => ({
  id: idOf(n) as AccountGroupId,
  accountType: 'asset',
  name,
  description: null,
  position,
});

const BANK = group(50, 'Bank', 1);
const CASH = account(1, 'Cash', 0);
const WALLET = account(2, 'Wallet', 2);
const ABC_BANK = account(3, 'ABC Bank', 0, BANK.id);
const GRACES_CASH = account(4, 'Cash', 0);
const GRACES_WALLET = account(5, 'Wallet', 1);

const moving = (
  node: Account,
  index: number,
  groupId: AccountGroupId | null = null,
): MoveChartNodeInput => ({
  node: { kind: 'account', id: node.id },
  accountType: 'asset',
  groupId,
  index,
});

function useCases() {
  const held = inMemoryAccounts();
  held.hold(ADA_ID, [CASH, WALLET, ABC_BANK], [BANK]);
  held.hold(GRACE_ID, [GRACES_CASH, GRACES_WALLET]);
  return {
    ...held,
    moveChartNode: createMoveChartNode({ accounts: held.accounts }),
    getChart: createGetChart({ accounts: held.accounts }),
  };
}

const UNMOVED = ok([
  { kind: 'account', account: CASH },
  { kind: 'group', group: BANK, accounts: [ABC_BANK] },
  { kind: 'account', account: WALLET },
]);

describe('createMoveChartNode', () => {
  it('moves an Account to the place it is given and keeps the order, answering with the list it renumbered', async () => {
    const { moveChartNode, getChart } = useCases();
    const placed = {
      accounts: [
        { ...WALLET, position: 0 },
        { ...CASH, position: 1 },
      ],
      groups: [{ ...BANK, position: 2 }],
    };

    expect(await moveChartNode(ADA, moving(WALLET, 0))).toEqual(ok(placed));
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'account', account: placed.accounts[0] },
        { kind: 'account', account: placed.accounts[1] },
        { kind: 'group', group: placed.groups[0], accounts: [ABC_BANK] },
      ]),
    );
  });

  it('moves an Account into an Account group and out of it again', async () => {
    const { moveChartNode, getChart } = useCases();

    await moveChartNode(ADA, moving(CASH, 1, BANK.id));
    const banked = { ...CASH, groupId: BANK.id, position: 1 };
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'group', group: BANK, accounts: [ABC_BANK, banked] },
        { kind: 'account', account: WALLET },
      ]),
    );

    await moveChartNode(ADA, moving(ABC_BANK, 2));
    expect(await getChart(ADA)).toEqual(
      ok([
        { kind: 'group', group: { ...BANK, position: 0 }, accounts: [banked] },
        { kind: 'account', account: { ...WALLET, position: 1 } },
        { kind: 'account', account: { ...ABC_BANK, groupId: null, position: 2 } },
      ]),
    );
  });

  it('refuses a move the placement rules forbid, and changes nothing', async () => {
    const { moveChartNode, getChart } = useCases();

    const placed = await moveChartNode(ADA, {
      node: { kind: 'group', id: BANK.id },
      accountType: 'asset',
      groupId: BANK.id,
      index: 0,
    });

    expect(!placed.ok && placed.error.code).toBe('INVALID_INPUT');
    expect(await getChart(ADA)).toEqual(UNMOVED);
  });

  it("refuses to move another User's Account as not found, and leaves that User's chart untouched", async () => {
    const { moveChartNode, getChart } = useCases();

    const placed = await moveChartNode(ADA, moving(GRACES_WALLET, 0));

    expect(!placed.ok && placed.error.code).toBe('NOT_FOUND');
    expect(await getChart(GRACE)).toEqual(
      ok([
        { kind: 'account', account: GRACES_CASH },
        { kind: 'account', account: GRACES_WALLET },
      ]),
    );
  });

  it('refuses to move a node for nobody, as unauthenticated', async () => {
    const { moveChartNode, getChart } = useCases();

    const placed = await moveChartNode(SIGNED_OUT, moving(WALLET, 0));

    expect(!placed.ok && placed.error.code).toBe('UNAUTHENTICATED');
    expect(await getChart(ADA)).toEqual(UNMOVED);
  });

  it('reports a failed read of the chart as its own result', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts } = useCases();
    const moveChartNode = createMoveChartNode({
      accounts: { ...accounts, readChart: () => Promise.resolve(err(down)) },
    });

    expect(await moveChartNode(ADA, moving(WALLET, 0))).toEqual(err(down));
  });

  it('reports a failed save as its own result, rather than the places it could not keep', async () => {
    const down = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');
    const { accounts, getChart } = useCases();
    const moveChartNode = createMoveChartNode({
      accounts: { ...accounts, placeNodes: () => Promise.resolve(err(down)) },
    });

    expect(await moveChartNode(ADA, moving(WALLET, 0))).toEqual(err(down));
    expect(await getChart(ADA)).toEqual(UNMOVED);
  });
});
