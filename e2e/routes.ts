import { type Page } from '@playwright/test';

export const SIGN_IN_URL = /\/sign-in(\?.*)?$/;

export const ENTRIES_URL = /\/entries$/;

export const ENTRY_SEARCH_PATH = '/entries/search';

export const ENTRY_SEARCH_WITHOUT_QUERY = /\/entries\/search$/;

export const ENTRY_SEARCH_WITH_QUERY = /\/entries\/search\?.+$/;

export const INCOME_STATEMENT_PATH = '/income-statement';

export const INCOME_STATEMENT_WITHOUT_QUERY = /\/income-statement$/;

export const INCOME_STATEMENT_WITH_QUERY = /\/income-statement\?.+$/;

export const ASSETS_AND_LIABILITIES_PATH = '/assets-and-liabilities';

export const ASSETS_AND_LIABILITIES_WITHOUT_QUERY = /\/assets-and-liabilities$/;

export const ASSETS_AND_LIABILITIES_WITH_QUERY = /\/assets-and-liabilities\?.+$/;

export const SETTINGS_PATH = '/settings';

export const SETTINGS_URL = /\/settings$/;

export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const queryOf = (page: Page): URLSearchParams => new URL(page.url()).searchParams;
