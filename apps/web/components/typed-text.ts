import { canBeChoseong, disassemble, getChoseong } from 'es-hangul';

const initialOf = (character: string): string => {
  const initial = getChoseong(character);
  return initial === '' ? character : initial;
};

const initialsOf = (text: string): string => Array.from(text, initialOf).join('');

const isInitialsOnly = (typed: string): boolean =>
  Array.from(typed).every((character) => character === ' ' || canBeChoseong(character));

export const matchesTyped = (text: string, typed: string): boolean => {
  const lowered = text.toLowerCase();
  const wanted = typed.trim().toLowerCase();
  if (isInitialsOnly(wanted)) return initialsOf(lowered).includes(wanted);
  return disassemble(lowered).includes(disassemble(wanted));
};
