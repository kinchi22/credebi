import { expect, type Locator, type Page } from '@playwright/test';
import { type Language } from './language';
import { HANGUL, JAPANESE } from './typed-text';

export const shownDay = (day: string): string => day.replaceAll('-', '');

export const DAY_PLACEHOLDER = 'YYYYMMDD';

export const MONTH_PLACEHOLDER = 'YYYYMM';

export const INVALID_DAY = 'Enter a date as YYYYMMDD';

export const INVALID_MONTH = 'Enter a month as YYYYMM';

export const MAX_DAY_DIGITS = 8;

export const MAX_MONTH_DIGITS = 6;

export const chooseDate = (scope: Page | Locator, index = 0): Locator =>
  scope.getByRole('button', { name: 'Choose date', exact: true }).nth(index);

export const chooseDateOf = (field: Locator): Locator =>
  field
    .locator(
      'xpath=ancestor::*[count(.//button[@aria-label="Choose date" or normalize-space()="Choose date"]) = 1][1]',
    )
    .getByRole('button', { name: 'Choose date', exact: true });

export const hiddenValue = (form: Locator, name: string): Locator => form.locator(`input[name="${name}"]`);

export async function selectDigits(field: Locator, start: number, end: number): Promise<void> {
  await field.evaluate(
    (input: { setSelectionRange: (from: number, to: number) => void }, [from, to]: readonly [number, number]) => {
      input.setSelectionRange(from, to);
    },
    [start, end] as const,
  );
}

export async function placeCaret(field: Locator, position: number): Promise<void> {
  await selectDigits(field, position, position);
}

export async function caretAt(field: Locator): Promise<readonly [number | null, number | null]> {
  return field.evaluate((input: { selectionStart: number | null; selectionEnd: number | null }) => [
    input.selectionStart,
    input.selectionEnd,
  ]);
}

export const validationMessage = (field: Locator): Promise<string> =>
  field.evaluate((input: { readonly validationMessage: string }) => input.validationMessage);

export async function expectRefusedAs(
  field: Locator,
  language: Language,
  english: string,
  format: string,
): Promise<void> {
  if (language === 'en') {
    await expect(field).toHaveJSProperty('validationMessage', english);
    return;
  }
  const script = language === 'ko' ? HANGUL : JAPANESE;
  await expect.poll(() => validationMessage(field)).toMatch(script);
  const message = await validationMessage(field);
  expect(message).toContain(format);
  expect(message).not.toContain(english);
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

const FRAME_BOX = `(input) => {
  let node = input;
  while (node !== null) {
    const style = getComputedStyle(node);
    if (parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderLeftWidth) > 0) break;
    node = node.parentElement;
  }
  const { x, y, width, height } = (node ?? input).getBoundingClientRect();
  return { x, y, width, height };
}`;

export async function expectInsideFrame(field: Locator, button: Locator): Promise<void> {
  const frame = await field.evaluate<Box, undefined>(FRAME_BOX, undefined);
  const box = await button.boundingBox();
  if (box === null) throw new Error('the button must be on screen');
  const tolerance = 1;
  expect(box.x, 'the button starts inside the field frame').toBeGreaterThanOrEqual(frame.x - tolerance);
  expect(box.x + box.width, 'the button ends inside the field frame').toBeLessThanOrEqual(
    frame.x + frame.width + tolerance,
  );
  expect(box.y).toBeGreaterThanOrEqual(frame.y - tolerance);
  expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + tolerance);
}
