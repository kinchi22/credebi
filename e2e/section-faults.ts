import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export type FaultSection =
  | 'settings.entry-form-mode'
  | 'settings.accounts'
  | 'settings.language'
  | 'settings.connections'
  | 'entries.form'
  | 'entries.list'
  | 'income-statement.report'
  | 'assets-and-liabilities.report'
  | 'assets-and-liabilities-trend.chart'
  | 'entry-search.results';

export type FaultMode = 'hold' | 'fail';

export type FaultModes = Readonly<Partial<Record<FaultSection, FaultMode>>>;

export const FAULTS_COOKIE = 'credebi-faults';

export type Faults = {
  readonly set: (modes: FaultModes) => Promise<void>;
  readonly release: (section: FaultSection) => Promise<void>;
};

const cookieValue = (token: string, modes: FaultModes): string =>
  encodeURIComponent(
    `${token};${Object.entries(modes)
      .map(([section, mode]) => `${section}:${mode}`)
      .join(',')}`,
  );

export async function injectFaults(
  page: Page,
  initial: FaultModes = {},
  origin: string = new URL(page.url()).origin,
): Promise<Faults> {
  const token = randomUUID();
  const set = async (modes: FaultModes): Promise<void> => {
    await page.context().addCookies([{ name: FAULTS_COOKIE, value: cookieValue(token, modes), url: origin }]);
  };
  const release = async (section: FaultSection): Promise<void> => {
    const response = await page.request.post(`${origin}/api/e2e/faults/${token}/${section}/release`);
    expect(response.ok(), `releasing ${section}`).toBe(true);
  };
  await set(initial);
  return { set, release };
}
