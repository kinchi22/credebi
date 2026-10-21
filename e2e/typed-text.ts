import { type CDPSession, type Page } from '@playwright/test';

export const STARBUCKS = '\uC2A4\uD0C0\uBC85\uC2A4';

export const SHINHAN_CARD = '\uC2E0\uD55C\uCE74\uB4DC';

export const STARBUCKS_INITIALS = '\u3145\u314C\u3142\u3145';

export const SUTABA = '\u30B9\u30BF\u30D0';

export const SUTABA_IN_HIRAGANA = '\u3059\u305F\u3070';

export const HANGUL = /\p{Script=Hangul}/u;

export async function startComposing(page: Page, text: string): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  return cdp;
}

export async function finishComposing(cdp: CDPSession, text: string): Promise<void> {
  await cdp.send('Input.insertText', { text });
}
