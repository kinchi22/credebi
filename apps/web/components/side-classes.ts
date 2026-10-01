import { sideSchema, type Side } from '@repo/contracts';

export const SIDES: readonly Side[] = sideSchema.options;

export const SIDE_TONE: Readonly<Record<Side, { readonly text: string; readonly edge: string }>> = {
  debit: { text: 'text-debit', edge: 'border-debit' },
  credit: { text: 'text-credit', edge: 'border-credit' },
};
