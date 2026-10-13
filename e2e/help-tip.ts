import { expect, type Locator, type Page } from '@playwright/test';
import { SETTINGS_URL } from './routes';

export const helpTipButton = (scope: Locator, message: string): Locator =>
  scope.getByRole('button', { name: `About ${message}`, exact: true });

export const helpTipExplanation = (page: Page, text: string): Locator => page.getByText(text);

export const settingsLink = (shown: Locator): Locator =>
  shown.getByRole('link', { name: /\bSettings\b/ });

export const NEEDS_MULTI_LINE_MODE = 'Needs Multi-line mode';

export const NOT_ACTIVE_ON_THIS_DAY = 'Not active on this day';

export const needsMultiLineExplanation = (title: string): string =>
  `The last Entry titled ${title} has more than one line on a Side, so nothing was filled in. Choose a debit and a credit account to write this Entry yourself, or change the Entry form mode in Settings to fill every line.`;

export const twoLineNotActiveExplanation = (account: string): string =>
  `${account} can be used only within its active period. Change the day, choose another account, or change the period in Settings.`;

export const multiLineNotActiveExplanation = (account: string): string =>
  `${account} can be used only within its active period. Change the day, remove the line, or change the period in Settings.`;

export async function openHelpTip(button: Locator, text: string): Promise<Locator> {
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const shown = helpTipExplanation(button.page(), text);
  await expect(shown).toBeVisible();
  return shown;
}

export async function followSettingsLink(button: Locator, text: string): Promise<void> {
  const shown = await openHelpTip(button, text);
  await settingsLink(shown).click();
  await expect(button.page()).toHaveURL(SETTINGS_URL);
}
