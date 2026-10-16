import { canBeChoseong, disassemble, getChoseong } from 'es-hangul';

const RUN_NFKC_LEAVES_UNCOMPOSED = /[^\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF]+/gu;

const KATAKANA = /[\u30A1-\u30F6]/gu;

const HIRAGANA_FROM_KATAKANA = 0x60;

const toHiragana = (katakana: string): string =>
  String.fromCharCode(katakana.charCodeAt(0) - HIRAGANA_FROM_KATAKANA);

const fold = (text: string): string =>
  text
    .replace(RUN_NFKC_LEAVES_UNCOMPOSED, (run) => run.normalize('NFKC'))
    .replace(KATAKANA, toHiragana)
    .toLowerCase();

const initialOf = (character: string): string => {
  const initial = getChoseong(character);
  return initial === '' ? character : initial;
};

const initialsOf = (text: string): string => Array.from(text, initialOf).join('');

const SPACES = new Set([' ', '\u3000']);

const isInitialsOnly = (typed: string): boolean =>
  Array.from(typed).every((character) => SPACES.has(character) || canBeChoseong(character));

export const matchesTyped = (text: string, typed: string): boolean => {
  const wanted = typed.trim();
  if (isInitialsOnly(wanted)) return fold(initialsOf(text)).includes(fold(wanted));
  return fold(disassemble(text)).includes(fold(disassemble(wanted)));
};
