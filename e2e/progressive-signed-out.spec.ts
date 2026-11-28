import { expect, test } from '@playwright/test';
import { PAGES } from './progressive-pages';
import { SIGN_IN_URL } from './routes';
import { type FaultModes, injectFaults } from './section-faults';
import { busySections } from './section-states';

for (const view of PAGES) {
  test(`${view.name}: redirects a signed-out request to sign in even with every section held`, async ({ page, baseURL }) => {
    expect(baseURL, 'the spec needs a baseURL to scope the faults cookie to').toBeDefined();
    const held: FaultModes = Object.fromEntries(view.sections.map((section) => [section.id, 'hold']));
    await injectFaults(page, held, new URL(baseURL ?? '').origin);

    await page.goto(view.path, { waitUntil: 'commit' });

    await expect(page).toHaveURL(SIGN_IN_URL);
    await expect(page.getByRole('form', { name: 'Test sign-in' })).toBeVisible();
    await expect(busySections(page)).toHaveCount(0);
  });
}
