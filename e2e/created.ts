import { expect } from '@playwright/test';
import { createDatabase } from '@repo/db';

export const TWO_YEARS_AND_A_DAY = '2 years 1 day';

export const TWO_YEARS_LESS_A_DAY = '2 years -1 day';

export async function createdAgo(memo: string, age: string): Promise<void> {
  const url = process.env['DATABASE_URL'] ?? '';
  expect(url, 'backdating an Entry needs the DATABASE_URL the app runs against').not.toBe('');
  const { database, close } = createDatabase(url);
  try {
    const result = await database.execute(
      `UPDATE entries SET created_at = now() - interval '${age}' WHERE memo = '${memo.replaceAll("'", "''")}'`,
    );
    expect(result.rowCount, `one Entry carries the memo ${memo}`).toBe(1);
  } finally {
    await close();
  }
}
