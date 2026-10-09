import type { AccountGroupId, AccountId, ChartNodeOutput } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { droppedMove, measuredHits, measuredOf, type ChartDropTarget } from './chart-drop';

const id = (tail: string): string => `01920000-0000-7000-8000-${tail.padStart(12, '0')}`;

const account = (tail: string, name: string, groupId: AccountGroupId | null = null) => ({
  id: id(tail) as AccountId,
  accountType: 'asset' as const,
  groupId,
  name,
  description: null,
  activeFrom: '2026-09-01',
  activeUntil: null,
});

const group = (tail: string, name: string) => ({
  id: id(tail) as AccountGroupId,
  accountType: 'asset' as const,
  name,
  description: null,
});

const BANK = group('b001', 'Bank');
const SAVINGS = group('b002', 'Savings');
const CASH = account('c001', 'Cash');
const ABC = account('c002', 'ABC Bank', BANK.id);
const XYZ = account('c003', 'XYZ Bank', BANK.id);
const WALLET = account('c004', 'Wallet');

const CHART: readonly ChartNodeOutput[] = [
  { kind: 'account', account: CASH },
  { kind: 'group', group: BANK, accounts: [ABC, XYZ] },
  { kind: 'account', account: WALLET },
  { kind: 'group', group: SAVINGS, accounts: [] },
];

const asset = { accountType: 'asset', groupId: null } as const;
const inBank = { accountType: 'asset', groupId: BANK.id } as const;
const cash = { kind: 'account', id: CASH.id } as const;
const xyz = { kind: 'account', id: XYZ.id } as const;
const savings = { kind: 'group', id: SAVINGS.id } as const;
const span = { top: 100, height: 40 };

const heading = (groupId: AccountGroupId): ChartDropTarget => ({ on: 'heading', accountType: 'asset', groupId });

const dropped = (node: typeof cash | typeof xyz | typeof savings, target: ChartDropTarget, pointer: number) =>
  droppedMove(CHART, node, { target, span, pointer });

describe('droppedMove', () => {
  it("puts an Account dropped on an Account group's heading, below its top quarter, last in that group", () => {
    expect(dropped(cash, heading(BANK.id), 110)).toEqual({ node: cash, ...inBank, index: 2 });
    expect(dropped(cash, heading(SAVINGS.id), 139)).toEqual({
      node: cash,
      accountType: 'asset',
      groupId: SAVINGS.id,
      index: 0,
    });
  });

  it("puts an Account dropped on the top quarter of an Account group's heading at the top level just before that group", () => {
    expect(dropped(xyz, heading(SAVINGS.id), 109)).toEqual({ node: xyz, ...asset, index: 3 });
    expect(dropped(cash, heading(SAVINGS.id), 100)).toEqual({ node: cash, ...asset, index: 2 });
  });

  it('never puts an Account group into a group by its heading', () => {
    expect(dropped(savings, heading(BANK.id), 130)).toBeUndefined();
  });

  it('puts a node dropped on the drop zone at the end of a list last in that list', () => {
    expect(dropped(xyz, { on: 'end', place: asset }, 0)).toEqual({ node: xyz, ...asset, index: 4 });
    expect(dropped(cash, { on: 'end', place: inBank }, 0)).toEqual({ node: cash, ...inBank, index: 2 });
  });

  it('puts a node dropped on a row in another list before that row in its upper half and after it in its lower half', () => {
    const abcRow: ChartDropTarget = { on: 'row', place: inBank, node: { kind: 'account', id: ABC.id }, next: XYZ.id };

    expect(dropped(cash, abcRow, 120)).toEqual({ node: cash, ...inBank, index: 0 });
    expect(dropped(cash, abcRow, 121)).toEqual({ node: cash, ...inBank, index: 1 });
    expect(dropped(cash, { on: 'row', place: inBank, node: xyz, next: null }, 130)).toEqual({
      node: cash,
      ...inBank,
      index: 2,
    });
  });

  it('moves a node within its own list to before or after the row it is dropped on', () => {
    const walletRow: ChartDropTarget = { on: 'row', place: asset, node: { kind: 'account', id: WALLET.id }, next: SAVINGS.id };

    expect(dropped(cash, walletRow, 130)).toEqual({ node: cash, ...asset, index: 2 });
    expect(dropped(savings, walletRow, 110)).toEqual({ node: savings, ...asset, index: 2 });
  });

  it('leaves a node where it is when dropped on itself or on the edge it shares with a neighbour', () => {
    const cashRow: ChartDropTarget = { on: 'row', place: asset, node: cash, next: BANK.id };

    expect(dropped(cash, cashRow, 110)).toBeUndefined();
    expect(dropped(cash, cashRow, 130)).toBeUndefined();
    expect(dropped(cash, heading(BANK.id), 101)).toBeUndefined();
  });
});

describe('measuredHits', () => {
  it("measures each hit by the pointer and the hit's own rect, keeping what the hit carried", () => {
    const rects = new Map([['bank', { top: 240, height: 32, left: 0, width: 300 }]]);
    const [hit] = measuredHits([{ id: 'bank', data: { value: 3 } }], { y: 250 }, rects);

    expect(hit).toMatchObject({ id: 'bank', data: { value: 3 } });
    expect(measuredOf(hit)).toEqual({ span: { top: 240, height: 32 }, pointer: 250 });
  });

  it('leaves a hit unmeasured with no pointer or no rect', () => {
    const rects = new Map([['bank', { top: 240, height: 32 }]]);

    expect(measuredOf(measuredHits([{ id: 'bank' }], null, rects)[0])).toBeUndefined();
    expect(measuredOf(measuredHits([{ id: 'cash' }], { y: 250 }, rects)[0])).toBeUndefined();
    expect(measuredOf(undefined)).toBeUndefined();
  });
});
