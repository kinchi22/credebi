import type { AccountId, AccountOutput } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { settleAccount } from './settle-account';

const account = (tail: string, name: string): AccountOutput => ({
  id: `01920000-0000-7000-8000-${tail.padStart(12, '0')}` as AccountId,
  accountType: 'asset',
  groupId: null,
  name,
  description: null,
  activeFrom: '2026-01-01',
  activeUntil: null,
});

const CASH = account('c001', 'Cash');
const PETTY_CASH = account('c002', 'Petty cash');
const PAYABLE = account('c003', 'Accounts payable');
const CAPITAL = account('c004', 'Capital');
const STARBUCKS = account('c005', '\uC2A4\uD0C0\uBC85\uC2A4');

const ACCOUNTS = [PETTY_CASH, CASH, PAYABLE, CAPITAL, STARBUCKS];

describe('settleAccount', () => {
  it('settles empty text to Any account', () => {
    expect(settleAccount('', ACCOUNTS)).toEqual({ outcome: 'any' });
  });

  it('settles text of only spaces to Any account', () => {
    expect(settleAccount(' \u3000\t ', ACCOUNTS)).toEqual({ outcome: 'any' });
  });

  it('settles text that is an Account name exactly, ignoring case and surrounding spaces, to it even when other names contain it', () => {
    expect(settleAccount('cASH', ACCOUNTS)).toEqual({ outcome: 'account', account: CASH });
    expect(settleAccount('  Cash ', ACCOUNTS)).toEqual({ outcome: 'account', account: CASH });
  });

  it('settles text that Typed match finds in exactly one Account name to that Account', () => {
    expect(settleAccount('PAYAB', ACCOUNTS)).toEqual({ outcome: 'account', account: PAYABLE });
    expect(settleAccount('petty', ACCOUNTS)).toEqual({ outcome: 'account', account: PETTY_CASH });
    expect(settleAccount('\u3145\u314C', ACCOUNTS)).toEqual({ outcome: 'account', account: STARBUCKS });
  });

  it('refuses text that matches no Account', () => {
    expect(settleAccount('absent', ACCOUNTS)).toEqual({ outcome: 'refused' });
    expect(settleAccount('Cash', [])).toEqual({ outcome: 'refused' });
  });

  it('refuses text that matches several Accounts and none of them exactly', () => {
    expect(settleAccount('ca', ACCOUNTS)).toEqual({ outcome: 'refused' });
    expect(settleAccount('cas', ACCOUNTS)).toEqual({ outcome: 'refused' });
  });
});
