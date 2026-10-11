export const matchesTyped = (name: string, typed: string): boolean =>
  name.toLowerCase().includes(typed.trim().toLowerCase());
