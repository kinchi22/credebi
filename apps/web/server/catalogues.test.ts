import { describe, expect, it } from 'vitest';
import { startingAccountNames } from './catalogues';

describe('startingAccountNames', () => {
  it.each([
    ['en', ['Cash', 'Accounts payable', 'Capital', 'Sales', 'Expenses']],
    ['ko', ['\uD604\uAE08', '\uB9E4\uC785\uCC44\uBB34', '\uC790\uBCF8\uAE08', '\uB9E4\uCD9C', '\uBE44\uC6A9']],
    ['ja', ['\u73FE\u91D1', '\u8CB7\u639B\u91D1', '\u8CC7\u672C\u91D1', '\u58F2\u4E0A', '\u8CBB\u7528']],
  ] as const)('names the five starting Accounts in %s, one per Account type', (language, names) => {
    const named = startingAccountNames(language);

    expect([named.asset, named.liability, named.equity, named.revenue, named.expense]).toEqual(names);
  });
});
