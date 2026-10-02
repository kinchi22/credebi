import { sideSchema, type Side } from '@repo/contracts';

export const SIDES: readonly Side[] = sideSchema.options;

type SideTone = { readonly text: string; readonly edge: string; readonly fill: string };

export const SIDE_TONE: Readonly<Record<Side, SideTone>> = {
  debit: { text: 'text-debit', edge: 'border-debit', fill: 'fill-debit' },
  credit: { text: 'text-credit', edge: 'border-credit', fill: 'fill-credit' },
};
