import { describe, expect, it } from 'vitest';
import { fontFaces, typeScale, type TypeStepName } from './tokens';
import { typeClasses } from './type-classes';

const faceUtility = (family: string): string => {
  const face = Object.entries(fontFaces).find(([, name]) => name === family)?.[0];
  return `font-${face ?? 'undeclared'}`;
};

const expectedClasses = (name: TypeStepName): readonly string[] => {
  const step = typeScale[name];
  return [
    `text-${name}`,
    faceUtility(step.fontFamily),
    ...(step.caps ? ['uppercase'] : []),
    ...(step.tabularNumerals ? ['tabular-nums'] : []),
  ];
};

describe('typeClasses', () => {
  it.each(Object.keys(typeScale) as TypeStepName[])(
    'sets the %s step with its size, its face, its capitals and its numerals',
    (name) => {
      expect(typeClasses[name].split(' ')).toEqual(expectedClasses(name));
    },
  );

  it('sets dates and amounts in DM Mono with tabular numerals', () => {
    expect(typeClasses.date).toBe('text-date font-mono tabular-nums');
    expect(typeClasses.figure).toBe('text-figure font-mono tabular-nums');
  });

  it('sets labels in DM Mono capitals and body text in Sora', () => {
    expect(typeClasses.label).toBe('text-label font-mono uppercase');
    expect(typeClasses.body).toBe('text-body font-sans');
  });
});
