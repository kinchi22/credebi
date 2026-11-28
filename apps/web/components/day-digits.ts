export const DAY_DIGITS = 8;

const YEAR_DIGITS = 4;
const MONTH_END = 6;
const FIRST_YEAR = 1;
const MONTHS_A_YEAR = 12;
const FEBRUARY = 2;
const MONTHS_WITH_THIRTY: ReadonlySet<number> = new Set([4, 6, 9, 11]);
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
): DigitEdit {
  const digitsBeforeCaret = countDigits(raw.slice(0, rawCaret));
  const typedOne = raw.length === previous.length + 1;
  const wanted = digitsOf(raw);
  if (typedOne && wanted.length > limit) {
    return { digits: previous, caret: Math.max(0, digitsBeforeCaret - 1) };
  }
  const digits = wanted.slice(0, limit);
  return { digits, caret: Math.min(digitsBeforeCaret, digits.length) };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === FEBRUARY) {
    return isLeapYear(year) ? 29 : 28;
  }
  return MONTHS_WITH_THIRTY.has(month) ? 30 : 31;
}

export function isDayDigits(digits: string): boolean {
  if (!DAY_TEXT.test(digits)) {
    return false;
  }
  const year = Number(digits.slice(0, YEAR_DIGITS));
  const month = Number(digits.slice(YEAR_DIGITS, MONTH_END));
  const day = Number(digits.slice(MONTH_END));
  return year >= FIRST_YEAR && month >= 1 && month <= MONTHS_A_YEAR && day >= 1 && day <= daysInMonth(year, month);
}

export function isoOfDayDigits(digits: string): string | undefined {
  return isDayDigits(digits)
    ? `${digits.slice(0, YEAR_DIGITS)}-${digits.slice(YEAR_DIGITS, MONTH_END)}-${digits.slice(MONTH_END)}`
    : undefined;
}

export function digitsOfIsoDay(iso: string): string {
  return firstDigits(iso, DAY_DIGITS);
}
