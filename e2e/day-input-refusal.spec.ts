import { expect, test, type Page } from '@playwright/test';
import { activeUntil, BOOKS_OPEN, nameField, openAdd, pressSave } from './accounts';
import { reportDate, reportDateForm } from './assets-and-liabilities';
import { expectRefusedAs, INVALID_DAY, validationMessage } from './day-input';
import { fromField, searchButton, toField } from './entry-search';
import { chooseLanguageAtSettings, documentLanguage, type Language } from './language';
import { ASSETS_AND_LIABILITIES_PATH, ENTRY_SEARCH_PATH, SETTINGS_PATH, withQuery } from './routes';
import { signIn } from './session';

const REPORT_WITHOUT_QUERY = /\/assets-and-liabilities$/;

const LANGUAGES = ['en', 'ko', 'ja'] as const;

const INCOMPLETE = ['', '2026', '202611', '2026112', '2026-1-5', '2026/11/5', '1126'] as const;

const IMPOSSIBLE = [
  '20260230',
  '20260229',
  '20250229',
  '19000229',
  '21000229',
  '20260431',
  '20260631',
  '20260931',
  '20261131',
  '20260132',
  '20260100',
  '20260001',
  '20261301',
  '20260000',
  '00000101',
  '00000000',
  '99999999',
] as const;

const LEAP_DAYS = ['20240229', '20000229', '20280229'] as const;

const dated = (day: string): ((url: URL) => boolean) => withQuery(ASSETS_AND_LIABILITIES_PATH, { date: day });

async function openReport(page: Page, language: Language = 'en'): Promise<void> {
  if (language !== 'en') await chooseLanguageAtSettings(page, language);
  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await expect(documentLanguage(page)).toHaveAttribute('lang', language);
  await expect(reportDateForm(page)).toBeVisible();
}

async function pressShow(page: Page): Promise<void> {
  await reportDateForm(page).getByRole('button', { name: 'Show', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
});

for (const language of LANGUAGES) {
  test(`refuses an incomplete day on submit, saying to enter a date as YYYYMMDD in ${language}`, async ({ page }) => {
    await openReport(page, language);

    await reportDate(page).fill('2026112');
    await pressShow(page);

    await expectRefusedAs(reportDate(page), language, INVALID_DAY, 'YYYYMMDD');
    await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
    await expect(reportDate(page)).toHaveValue('2026112');
  });

  test(`refuses a day that does not exist on submit, saying to enter a date as YYYYMMDD in ${language}`, async ({ page }) => {
    await openReport(page, language);

    await reportDate(page).fill('20260230');
    await reportDate(page).press('Enter');

    await expectRefusedAs(reportDate(page), language, INVALID_DAY, 'YYYYMMDD');
    await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
    await expect(reportDate(page)).toHaveValue('20260230');
  });
}

for (const typed of INCOMPLETE) {
  test(`refuses ${typed === '' ? 'an empty day' : `the incomplete day ${typed}`} on submit`, async ({ page }) => {
    await openReport(page);

    await reportDate(page).fill(typed);
    await pressShow(page);

    if (typed === '') {
      await expect.poll(() => validationMessage(reportDate(page))).not.toBe('');
    } else {
      await expect(reportDate(page)).toHaveJSProperty('validationMessage', INVALID_DAY);
    }
    await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
  });
}

for (const typed of IMPOSSIBLE) {
  test(`refuses the impossible day ${typed} on submit`, async ({ page }) => {
    await openReport(page);

    await reportDate(page).fill(typed);
    await pressShow(page);

    await expect(reportDate(page)).toHaveJSProperty('validationMessage', INVALID_DAY);
    await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);
    await expect(reportDate(page)).toHaveValue(typed);
  });
}

for (const typed of LEAP_DAYS) {
  test(`accepts 29 February of the leap year in ${typed} on submit`, async ({ page }) => {
    await openReport(page);

    await reportDate(page).fill(typed);
    await pressShow(page);

    const iso = `${typed.slice(0, 4)}-${typed.slice(4, 6)}-${typed.slice(6)}`;
    await expect(page).toHaveURL(dated(iso));
    await expect(reportDate(page)).toHaveValue(typed);
  });
}

test('accepts the first and the last day the app can hold, 00010101 and 99991231', async ({ page }) => {
  await openReport(page);

  await reportDate(page).fill('00010101');
  await pressShow(page);
  await expect(page).toHaveURL(dated('0001-01-01'));

  await reportDate(page).fill('99991231');
  await pressShow(page);
  await expect(page).toHaveURL(dated('9999-12-31'));
});

test('accepts a day typed as unpadded text only once it is eight digits', async ({ page }) => {
  await openReport(page);

  await reportDate(page).fill('2026-9-5');
  await pressShow(page);
  await expect(reportDate(page)).toHaveJSProperty('validationMessage', INVALID_DAY);
  await expect(page).toHaveURL(REPORT_WITHOUT_QUERY);

  await reportDate(page).fill('2026-09-05');
  await pressShow(page);
  await expect(page).toHaveURL(dated('2026-09-05'));
});

test('refuses Entry search with an incomplete From or To, and searches once both are complete', async ({ page }) => {
  await page.goto(ENTRY_SEARCH_PATH);

  await fromField(page).fill('202609');
  await searchButton(page).click();
  await expect(fromField(page)).toHaveJSProperty('validationMessage', INVALID_DAY);
  await expect(page).toHaveURL(/\/entries\/search$/);

  await fromField(page).fill('20260901');
  await toField(page).fill('2026093');
  await searchButton(page).click();
  await expect(toField(page)).toHaveJSProperty('validationMessage', INVALID_DAY);
  await expect(page).toHaveURL(/\/entries\/search$/);

  await toField(page).fill('20260930');
  await searchButton(page).click();
  await expect(page).toHaveURL(withQuery(ENTRY_SEARCH_PATH, { from: '2026-09-01', to: '2026-09-30' }));
});

test('accepts an optional day only when it is entirely empty, refusing it once partly typed', async ({ page }) => {
  await page.goto(SETTINGS_PATH);
  const dialog = await openAdd(page, 'Assets', 'account');
  await nameField(dialog).fill('Pocket money');

  await activeUntil(dialog).fill('2026093');
  await pressSave(dialog);

  await expect(activeUntil(dialog)).toHaveJSProperty('validationMessage', INVALID_DAY);
  await expect(dialog).toBeVisible();

  await activeUntil(dialog).fill('20260230');
  await pressSave(dialog);

  await expect(activeUntil(dialog)).toHaveJSProperty('validationMessage', INVALID_DAY);
  await expect(dialog).toBeVisible();

  await activeUntil(dialog).fill('');
  await pressSave(dialog);

  await expect(dialog).toBeHidden();
});
