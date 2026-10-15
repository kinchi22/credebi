import { canBeChoseong, disassemble, getChoseong } from 'es-hangul';

const initialOf = (character: string): string => {
  const initial = getChoseong(character);
  return initial === '' ? character : initial;
};

const initialsOf = (text: string): string => Array.from(text, initialOf).join('');

const isInitialsOnly = (typed: string): boolean =>
  Array.from(typed).every((character) => character === ' ' || canBeChoseong(character));

export const matchesTyped = (text: string, typed: string): boolean => {
  const name = text.toLowerCase();
  const wanted = typed.trim().toLowerCase();
  if (isInitialsOnly(wanted)) return initialsOf(name).includes(wanted);
  return disassemble(name).includes(disassemble(wanted));
};
