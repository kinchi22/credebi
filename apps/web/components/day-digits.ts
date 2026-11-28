import { calendarMonthSchema, entryDateSchema } from '@repo/contracts';

export const DAY_DIGITS = 8;
export const MONTH_DIGITS = 6;

const YEAR_DIGITS = 4;
const MONTH_END = 6;
const NO_YEAR = '0000';
const DIGIT = /\d/gu;
const NOT_DIGIT = /\D/gu;
const DAY_TEXT = /^\d{8}$/u;

export const digitsOf = (text: string): string => text.replace(NOT_DIGIT, '');

export const firstDigits = (text: string, limit: number): string => digitsOf(text).slice(0, limit);

export type DigitEdit = {
  readonly digits: string;
  readonly caret: number;
};

const countDigits = (text: string): number => text.match(DIGIT)?.length ?? 0;

export function editedDigits(
  previous: string,
  raw: string,
  rawCaret: number,
  limit: number,
  typedOne: boolean,
): DigitEdit {
  const digitsBeforeCaret = countDigits(raw.slice(0, rawCaret));
  const wanted = digitsOf(raw);
  if (typedOne && wanted.length > limit) {
    return { digits: previous, caret: Math.max(0, digitsBeforeCaret - 1) };
  }
  const digits = wanted.slice(0, limit);
  return { digits, caret: Math.min(digitsBeforeCaret, digits.length) };
}

export function isoOfDayDigits(digits: string): string | undefined {
  if (!DAY_TEXT.test(digits) || digits.startsWith(NO_YEAR)) {
    return undefined;
  }
  const iso = `${digits.slice(0, YEAR_DIGITS)}-${digits.slice(YEAR_DIGITS, MONTH_END)}-${digits.slice(MONTH_END)}`;
  return entryDateSchema.safeParse(iso).success ? iso : undefined;
}

export const isDayDigits = (digits: string): boolean => isoOfDayDigits(digits) !== undefined;

export const digitsOfIsoDay = (iso: string): string => firstDigits(iso, DAY_DIGITS);

export function isoOfMonthDigits(digits: string): string | undefined {
  const iso = `${digits.slice(0, YEAR_DIGITS)}-${digits.slice(YEAR_DIGITS)}`;
  return calendarMonthSchema.safeParse(iso).success ? iso : undefined;
}

export const digitsOfIsoMonth = (iso: string): string => firstDigits(iso, MONTH_DIGITS);
