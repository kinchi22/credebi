import { expect, test, type Locator, type Page } from '@playwright/test';
import { signIn } from './session';
import { SIGNED_IN_PAGES, sidebar } from './sidebar';

const PRODUCT = 'Credebi';

const REPOSITORY_NAME = 'Double Entry Bookkeeping';

const PRODUCT_TITLE = new RegExp(`^(?:.+ \u00B7 ${PRODUCT}|${PRODUCT})$`);

const SIGNED_OUT_PAGES = ['/', '/sign-in'] as const;

type ManifestIcon = {
  readonly src: string;
  readonly sizes?: string;
  readonly type?: string;
  readonly purpose?: string;
};

type Manifest = {
  readonly name?: string;
  readonly short_name?: string;
  readonly icons?: readonly ManifestIcon[];
};

const logo = (scope: Page | Locator): Locator =>
  scope.getByRole('img', { name: PRODUCT, exact: true });

async function expectNamedCredebi(page: Page): Promise<void> {
  await expect(page).toHaveTitle(PRODUCT_TITLE);
  expect(await page.title()).not.toContain(REPOSITORY_NAME);
  await expect(page.locator('body')).not.toContainText(REPOSITORY_NAME);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
}

async function homePageLinkOnItsOrigin(
  page: Page,
  selector: string,
  attribute: 'href' | 'content',
): Promise<string> {
  await page.goto('/');
  const element = page.locator(selector).first();
  await expect(element).toHaveAttribute(attribute, /\S/);
  const value = (await element.getAttribute(attribute)) ?? '';
  const linked = new URL(value, page.url());
  return new URL(`${linked.pathname}${linked.search}`, page.url()).toString();
}

async function fetchImageOfType(page: Page, url: string, contentType: RegExp): Promise<Buffer> {
  const response = await page.request.get(url);
  await expect(response).toBeOK();
  expect(response.headers()['content-type']).toMatch(contentType);
  return response.body();
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function expectPngOfSize(page: Page, url: string, size: string | undefined): Promise<void> {
  const body = await fetchImageOfType(page, url, /^image\/png\b/);
  expect(body.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(`${String(body.readUInt32BE(16))}x${String(body.readUInt32BE(20))}`).toBe(size);
}

const icoSizes = (body: Buffer): readonly string[] =>
  Array.from({ length: body.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index;
    const width = body.readUInt8(entry) === 0 ? 256 : body.readUInt8(entry);
    const height = body.readUInt8(entry + 1) === 0 ? 256 : body.readUInt8(entry + 1);
    return `${String(width)}x${String(height)}`;
  });

const isMaskable = (icon: ManifestIcon): boolean =>
  (icon.purpose ?? 'any').split(/\s+/).includes('maskable');

const REQUIRED_MANIFEST_ICONS = [
  { sizes: '192x192', maskable: false },
  { sizes: '512x512', maskable: false },
  { sizes: '512x512', maskable: true },
] as const;

const requiredManifestIcons = (manifest: Manifest): readonly (ManifestIcon | undefined)[] =>
  REQUIRED_MANIFEST_ICONS.map((required) =>
    (manifest.icons ?? []).find(
      (icon) => icon.sizes === required.sizes && isMaskable(icon) === required.maskable,
    ),
  );

async function expectOneLogo(page: Page): Promise<void> {
  await expect(logo(page)).toBeVisible();
  await expect(logo(page)).toHaveCount(1);
  await expect(logo(page).getByRole('img')).toHaveCount(0);
}

async function manifestOf(page: Page): Promise<{ readonly url: string; readonly manifest: Manifest }> {
  const url = await homePageLinkOnItsOrigin(page, 'link[rel="manifest"]', 'href');
  const response = await page.request.get(url);
  await expect(response).toBeOK();
  return { url, manifest: (await response.json()) as Manifest };
}

test('names every signed-out page Credebi and describes it', async ({ page }) => {
  for (const path of SIGNED_OUT_PAGES) {
    await page.goto(path);
    await expectNamedCredebi(page);
  }
});

test('names every signed-in page Credebi and describes it', async ({ page }) => {
  await signIn(page);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expectNamedCredebi(page);
  }
});

test('shows the Credebi logo once, in the Sidebar, on every signed-in page', async ({ page }) => {
  await signIn(page);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expectOneLogo(page);
    await expect(logo(sidebar(page))).toBeVisible();
  }
});

test('shows the Credebi logo once on the sign-in page', async ({ page }) => {
  await page.goto('/sign-in');

  await expectOneLogo(page);
});

test('serves the favicon as an icon at 16 and 32 pixels', async ({ page }) => {
  const body = await fetchImageOfType(page, '/favicon.ico', /^image\/(?:x-icon|vnd\.microsoft\.icon)\b/);

  expect(body.readUInt16LE(2)).toBe(1);
  expect(icoSizes(body)).toEqual(expect.arrayContaining(['16x16', '32x32']));
});

test('serves the SVG icon every page links to', async ({ page }) => {
  const url = await homePageLinkOnItsOrigin(page, 'link[rel="icon"][type="image/svg+xml"]', 'href');

  expect(new URL(url).pathname).toBe('/icon.svg');
  await fetchImageOfType(page, url, /^image\/svg\+xml\b/);
});

test('serves a 180 pixel apple icon', async ({ page }) => {
  const url = await homePageLinkOnItsOrigin(page, 'link[rel="apple-touch-icon"]', 'href');

  await expectPngOfSize(page, url, '180x180');
});

test('serves a 1200 by 630 link-preview image', async ({ page }) => {
  const url = await homePageLinkOnItsOrigin(page, 'meta[property="og:image"]', 'content');

  await expectPngOfSize(page, url, '1200x630');
});

test('names Credebi in the web manifest, with 192, 512 and maskable 512 icons', async ({ page }) => {
  const { manifest } = await manifestOf(page);

  expect(manifest.name).toBe(PRODUCT);
  expect(manifest.short_name).toBe(PRODUCT);

  expect(requiredManifestIcons(manifest)).not.toContain(undefined);
});

test('serves the 192, 512 and maskable 512 web manifest icons as PNGs at their stated size', async ({ page }) => {
  const { url: manifestUrl, manifest } = await manifestOf(page);

  for (const icon of requiredManifestIcons(manifest)) {
    expect(icon).toBeDefined();
    const url = new URL(icon?.src ?? '', manifestUrl).toString();
    await expectPngOfSize(page, url, icon?.sizes);
  }
});
