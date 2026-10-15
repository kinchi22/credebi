import { canBeChoseong, disassemble, getChoseong } from 'es-hangul';

const NOT_HANGUL = /[^\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF]+/gu;

const KATAKANA = /[\u30A1-\u30F6]/gu;

const HIRAGANA_FROM_KATAKANA = 0x60;

const toHiragana = (katakana: string): string =>
  String.fromCodePoint((katakana.codePointAt(0) ?? 0) - HIRAGANA_FROM_KATAKANA);

const fold = (text: string): string =>
  text
    .replace(NOT_HANGUL, (run) => run.normalize('NFKC'))
    .replace(KATAKANA, toHiragana)
    .toLowerCase();

const initialOf = (character: string): string => {
  const initial = getChoseong(character);
  return initial === '' ? character : initial;
};

const initialsOf = (text: string): string => Array.from(text, initialOf).join('');

const isInitialsOnly = (typed: string): boolean =>
  Array.from(typed).every((character) => character === ' ' || canBeChoseong(character));

export const matchesTyped = (text: string, typed: string): boolean => {
  const wanted = typed.trim();
  if (isInitialsOnly(wanted)) return fold(initialsOf(text)).includes(fold(wanted));
  return fold(disassemble(text)).includes(fold(disassemble(wanted)));
};
