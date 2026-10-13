import { describe, expect, it } from 'vitest';
import { titleKey, titleMatching } from './title-match';

const TITLES = [{ title: 'Groceries' }, { title: 'Salary' }] as const;

describe('titleKey', () => {
  it('folds a Title to the same key whatever its case', () => {
    expect(titleKey('Starbucks')).toBe(titleKey('sTARBUCKS'));
  });

  it('folds a Title to the same key whatever space surrounds it', () => {
    expect(titleKey('  Rent ')).toBe(titleKey('rent'));
  });

  it('keeps Titles that differ in more than case and surrounding space apart', () => {
    expect(titleKey('Grocer')).not.toBe(titleKey('Groceries'));
    expect(titleKey('Day rent')).not.toBe(titleKey('Dayrent'));
  });
});

describe('titleMatching', () => {
  it('finds the Title the typed one matches, ignoring case and surrounding space', () => {
    expect(titleMatching(TITLES, ' gROCERIES  ')).toBe(TITLES[0]);
    expect(titleMatching(TITLES, 'Salary')).toBe(TITLES[1]);
  });

  it('finds nothing for a Title only part of one offered', () => {
    expect(titleMatching(TITLES, 'Grocer')).toBeUndefined();
  });

  it('finds nothing for a blank Title, even where a blank one is offered', () => {
    expect(titleMatching([...TITLES, { title: '' }], '   ')).toBeUndefined();
  });
});
