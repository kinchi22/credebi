import { describe, expect, it } from 'vitest';
import { matchesTyped } from './typed-text';

describe('matchesTyped', () => {
  it('matches a name containing the typed text anywhere, ignoring case', () => {
    expect(matchesTyped('Starbucks', 'bucks')).toBe(true);
    expect(matchesTyped('Starbucks', 'AR')).toBe(true);
    expect(matchesTyped('starbucks', 'STAR')).toBe(true);
  });

  it('matches no name the typed text is not part of', () => {
    expect(matchesTyped('Salary', 'Bakery')).toBe(false);
    expect(matchesTyped('Rent', 'Rents')).toBe(false);
  });

  it('matches every name when nothing, or only spaces, is typed', () => {
    expect(matchesTyped('Salary', '')).toBe(true);
    expect(matchesTyped('Salary', '   ')).toBe(true);
  });

  it('ignores spaces around the typed text, and keeps those within it', () => {
    expect(matchesTyped('Blue Bottle', '  blue ')).toBe(true);
    expect(matchesTyped('Blue Bottle', 'e B')).toBe(true);
    expect(matchesTyped('BlueBottle', 'e B')).toBe(false);
  });
});
