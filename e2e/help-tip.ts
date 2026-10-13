import { expect, type Locator, type Page } from '@playwright/test';
import { SETTINGS_URL } from './routes';

export const helpTipButton = (scope: Locator, message: string): Locator =>
  scope.getByRole('button', { name: `About ${message}`, exact: true });

export const explanation = (page: Page, text: string): Locator => page.getByText(text);

export const settingsLink = (shown: Locator): Locator =>
  shown.getByRole('link', { name: /\bSettings\b/ });

export const NEEDS_MULTI_LINE_MODE = 'Needs Multi-line mode';

export const NOT_ACTIVE_ON_THIS_DAY = 'Not active on this day';

export const needsMultiLineExplanation = (title: string): string =>
  `The last Entry titled ${title} has more than one line on a Side. Two-line mode posts one debit and one credit line. Change the Entry form mode in Settings.`;

export const notActiveExplanation = (account: string): string =>
  `${account} can be used only within its active period. Change the day, remove the line, or change the period in Settings.`;

export async function openHelpTip(button: Locator, text: string): Promise<Locator> {
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const shown = explanation(button.page(), text);
  await expect(shown).toBeVisible();
  return shown;
}

export async function followSettingsLink(button: Locator, text: string): Promise<void> {
  const shown = await openHelpTip(button, text);
  await settingsLink(shown).click();
  await expect(button.page()).toHaveURL(SETTINGS_URL);
}
