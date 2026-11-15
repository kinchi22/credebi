import { expect, type Locator, type Page } from '@playwright/test';

export type EntryFormMode = 'Two-line mode' | 'Multi-line mode';

export const entryFormModes = (page: Page): Locator =>
  page.getByRole('group', { name: 'Entry form mode' });

export const entryFormModeChoice = (page: Page, mode: EntryFormMode): Locator =>
  entryFormModes(page).getByRole('radio', { name: mode });

export async function setEntryFormMode(page: Page, mode: EntryFormMode): Promise<void> {
  await page.goto('/settings');
  const choice = entryFormModeChoice(page, mode);
  await expect(choice).toBeVisible();
  if (!(await choice.isChecked())) {
    await choice.check();
    await expect(choice).toBeEnabled();
    await page.reload();
  }
  await expect(choice).toBeChecked();
}

export const connectionsSection = (page: Page, title = 'Connections'): Locator =>
  page.getByRole('region', { name: title, exact: true });

export const connectionItems = (page: Page, clientName: string): Locator =>
  page.getByRole('listitem').filter({ hasText: clientName });

export const shownOn = (label: string, day: string): RegExp => new RegExp(`${label}\\W*${day}`, 'i');

export const revokeButton = (scope: Locator): Locator =>
  scope.getByRole('button', { name: 'Revoke', exact: true });

export const revokeDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Revoke connection', exact: true });

export const revokeConnectionButton = (item: Locator, clientName: string): Locator =>
  item.getByRole('button', { name: `Revoke ${clientName}`, exact: true });

export async function revokeConnection(item: Locator, clientName: string): Promise<void> {
  await revokeConnectionButton(item, clientName).click();
  const dialog = revokeDialog(item.page());
  await expect(dialog).toBeVisible();
  await revokeButton(dialog).click();
  await expect(dialog).toBeHidden();
}

export const MCP_CLIENTS = ['Claude', 'ChatGPT'] as const;

export type McpClientName = (typeof MCP_CLIENTS)[number];

export const startConnectingButton = (page: Page): Locator =>
  connectionsSection(page).getByRole('button', { name: 'Start connecting', exact: true });

export const addConnectionButton = (page: Page): Locator =>
  connectionsSection(page).getByRole('button', { name: /^\+?\s*Add connection$/ });

export const mcpUrlField = (scope: Locator): Locator =>
  scope.getByRole('textbox', { name: 'MCP URL', exact: true });

export const connectionDialog = (page: Page): Locator =>
  page.getByRole('dialog').filter({ has: page.getByRole('tablist') });

const stepList = (dialog: Locator): Locator =>
  dialog.getByRole('list').filter({ has: dialog.page().getByRole('tablist') });

export const firstStep = (dialog: Locator): Locator => stepList(dialog).getByRole('listitem').first();

export const clientStep = (dialog: Locator): Locator =>
  stepList(dialog).getByRole('listitem').filter({ has: dialog.page().getByRole('tablist') });

export const lastStep = (dialog: Locator): Locator => stepList(dialog).getByRole('listitem').last();

export const stepCount = async (dialog: Locator): Promise<number> =>
  (await stepList(dialog).getByRole('listitem').count()) - (await clientStep(dialog).getByRole('listitem').count());

export const copyButton = (dialog: Locator): Locator => firstStep(dialog).getByRole('button');

export const clientTabs = (dialog: Locator): Locator => dialog.getByRole('tablist').getByRole('tab');

export const clientTab = (dialog: Locator, name: McpClientName): Locator =>
  dialog.getByRole('tablist').getByRole('tab', { name, exact: true });

export const clientGuidance = (dialog: Locator): Locator => dialog.getByRole('tabpanel');

export const liveRegions = (scope: Locator): Locator =>
  scope.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]');

export async function openConnectionDialog(opener: Locator): Promise<Locator> {
  await opener.click();
  const dialog = connectionDialog(opener.page());
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function grantClipboard(page: Page): Promise<void> {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin,
  });
}

export const clipboardText = async (page: Page): Promise<string> =>
  String(await page.evaluate('navigator.clipboard.readText()'));

export async function refuseClipboardWrites(page: Page): Promise<void> {
  await page.addInitScript({
    content:
      "Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')) });",
  });
}
