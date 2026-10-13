import { accountsIn, type ChartOutput, type TitleLine } from '@repo/contracts';
import { draftLinesInOrder } from '@repo/core/entries';
import { type NamedLine } from './lines-on-day';
import { SIDES } from './side-classes';

export type FormLines =
  | {
      readonly mode: 'two-line';
      readonly debit: string | undefined;
      readonly credit: string | undefined;
      readonly amount: string;
    }
  | {
      readonly mode: 'multi-line';
      readonly lines: readonly unknown[];
    };

export type PrefilledLine = NamedLine & {
  readonly amount: string;
};

export type Prefill =
  | { readonly outcome: 'kept' }
  | { readonly outcome: 'needs-multi-line' }
  | { readonly outcome: 'filled'; readonly lines: readonly PrefilledLine[] };

const isEmpty = (form: FormLines): boolean =>
  form.mode === 'two-line'
    ? form.debit === undefined && form.credit === undefined && form.amount.trim() === ''
    : form.lines.length === 0;

const hasOneLinePerSide = (source: readonly TitleLine[]): boolean =>
  SIDES.every((side) => source.filter((line) => line.side === side).length <= 1);

export function prefillFrom(
  form: FormLines,
  source: readonly TitleLine[],
  chart: ChartOutput,
): Prefill {
  if (!isEmpty(form)) {
    return { outcome: 'kept' };
  }
  if (form.mode === 'two-line' && !hasOneLinePerSide(source)) {
    return { outcome: 'needs-multi-line' };
  }
  const names = new Map(accountsIn(chart).map((account) => [account.id, account.name]));
  return {
    outcome: 'filled',
    lines: draftLinesInOrder(source).flatMap((line) => {
      const accountName = names.get(line.account);
      return accountName === undefined
        ? []
        : [{ side: line.side, account: line.account, accountName, amount: String(line.amount) }];
    }),
  };
}
