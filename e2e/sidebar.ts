import { type Locator, type Page } from '@playwright/test';

export const SIGNED_IN_PAGES = ['/entries', '/entries/search', '/settings'] as const;

export const sidebar = (page: Page): Locator => page.getByRole('navigation', { name: 'Sidebar' });

export const menu = (page: Page): Locator => page.getByRole('button', { name: 'Menu', exact: true });
