import { expect } from '@playwright/test';
import { createDatabase } from '@repo/db';

export const TWO_YEARS_AND_A_DAY = '2 years 1 day';

export const TWO_YEARS_LESS_A_DAY = '2 years -1 day';

export type Age = typeof TWO_YEARS_AND_A_DAY | typeof TWO_YEARS_LESS_A_DAY;

const PLAIN_MEMO = /^[\p{L}\p{N} -]+$/u;

export async function backdateEntry(memo: string, age: Age): Promise<void> {
  expect(memo, 'an Entry is backdated by a memo of letters, digits, spaces and hyphens').toMatch(PLAIN_MEMO);
  const url = process.env['DATABASE_URL'] ?? '';
  expect(url, 'backdating an Entry needs the DATABASE_URL the app runs against').not.toBe('');
  const { database, close } = createDatabase(url);
  try {
    const result = await database.execute(
      `UPDATE entries SET created_at = now() - interval '${age}' WHERE memo = '${memo}'`,
    );
    expect(result.rowCount, `one Entry carries the memo ${memo}`).toBe(1);
  } finally {
    await close();
  }
}
