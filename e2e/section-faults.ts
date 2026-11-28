import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';

export const FAULT_SECTIONS = [
  'settings.entry-form-mode',
  'settings.accounts',
  'settings.language',
  'settings.connections',
  'entries.form',
  'entries.list',
  'income-statement.report',
  'assets-and-liabilities.report',
  'assets-and-liabilities-trend.chart',
  'entry-search.results',
] as const;

export type FaultSection = (typeof FAULT_SECTIONS)[number];

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

export const busySections = (page: Page): Locator => page.locator('[aria-busy="true"]');

export const loadingMessages = (scope: Page | Locator): Locator => scope.getByRole('status');

export const skeletonBlocks = (section: Locator): Locator => section.locator('[aria-hidden="true"]');

export const tryAgain = (page: Page): Locator => page.getByRole('button', { name: 'Try again', exact: true });

export const sectionError = (page: Page): Locator => page.getByRole('alert');

const PLACEHOLDER_ROLES = [
  'row',
  'cell',
  'columnheader',
  'rowheader',
  'table',
  'list',
  'listitem',
  'textbox',
  'combobox',
  'button',
  'radio',
  'checkbox',
  'link',
  'img',
  'application',
];

export async function expectOnlyLoadingMessageExposed(section: Locator): Promise<void> {
  await expect(loadingMessages(section)).toHaveCount(1);
  const exposed = (await section.ariaSnapshot()).split('\n').map((line) => line.trim());
  for (const role of PLACEHOLDER_ROLES) {
    expect(
      exposed.filter((line) => line.startsWith(`- ${role}`)),
      `the loading section exposes no ${role}`,
    ).toEqual([]);
  }
}
