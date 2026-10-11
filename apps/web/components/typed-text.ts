export const matchesTyped = (text: string, typed: string): boolean =>
  text.toLowerCase().includes(typed.trim().toLowerCase());
