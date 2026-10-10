import { type TypeStepName } from './tokens';

export const typeClasses: Readonly<Record<TypeStepName, string>> = {
  display: 'text-display font-sans',
  h1: 'text-h1 font-sans',
  h2: 'text-h2 font-sans',
  title: 'text-title font-sans',
  body: 'text-body font-sans',
  'body-sm': 'text-body-sm font-sans',
  'body-dense': 'text-body-dense font-sans',
  label: 'text-label font-sans uppercase',
  figure: 'text-figure font-mono tabular-nums',
  date: 'text-date font-mono tabular-nums',
};
