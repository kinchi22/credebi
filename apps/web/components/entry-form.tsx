'use client';

import { ENTRY_FORM_FIELDS, type DomainErrorCode, type EntryFormMode } from '@repo/contracts';
import { CHART_OF_ACCOUNTS } from '@repo/core/entries';
import {
  Fragment,
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import { en } from '../messages/en';

export type EntryFormState =
  | { readonly outcome: 'idle' }
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

type EntryFormAction = (previous: EntryFormState, form: FormData) => Promise<EntryFormState>;

export type EntryFormProps = {
  readonly action: EntryFormAction;
};

type EntryFormShellProps = EntryFormProps & {
  readonly mode: EntryFormMode;
  readonly children: (id: string) => ReactNode;
};

type ShellState = {
  readonly result: EntryFormState;
  readonly resetKey: number;
};

const IDLE: ShellState = { result: { outcome: 'idle' }, resetKey: 0 };

const refusalsWith = (invalid: string): Readonly<Record<DomainErrorCode, string>> => ({
  UNBALANCED: en.entryForm.unbalanced,
  INVALID_INPUT: invalid,
  NOT_FOUND: invalid,
  CONFLICT: en.entryForm.unavailable,
  DEPENDENCY_UNAVAILABLE: en.entryForm.unavailable,
  UNAUTHENTICATED: en.entryForm.signedOut,
});

const REFUSAL: Readonly<Record<EntryFormMode, Readonly<Record<DomainErrorCode, string>>>> = {
  'two-line': refusalsWith(en.twoLineForm.invalid),
  'multi-line': refusalsWith(en.multiLineForm.invalid),
};

export const FIELD = 'flex flex-col gap-1 text-sm';
export const CONTROL = 'rounded border border-neutral-300 px-2 py-1';

export function AccountSelect({
  id,
  name,
}: {
  readonly id: string;
  readonly name: string;
}): ReactNode {
  return (
    <select id={id} name={name} required defaultValue="" className={CONTROL}>
      <option value="" disabled>
        {en.entryForm.chooseAccount}
      </option>
      {CHART_OF_ACCOUNTS.map((code) => (
        <option key={code} value={code}>
          {en.accounts[code]}
        </option>
      ))}
    </select>
  );
}

type AmountInputProps = {
  readonly id: string;
  readonly onAmountChange?: (amount: string) => void;
};

export function AmountInput({ id, onAmountChange }: AmountInputProps): ReactNode {
  return (
    <input
      id={id}
      name={ENTRY_FORM_FIELDS.amount}
      onChange={
        onAmountChange === undefined
          ? undefined
          : (event) => {
              onAmountChange(event.target.value);
            }
      }
      type="text"
      inputMode="numeric"
      pattern="[0-9]+"
      required
      className={`${CONTROL} text-right font-mono tabular-nums`}
    />
  );
}

export function EntryFormShell({ action, mode, children }: EntryFormShellProps): ReactNode {
  const [{ result: state, resetKey }, submitAction, pending] = useActionState(
    async (previous: ShellState, fields: FormData): Promise<ShellState> => {
      const result = await action(previous.result, fields);
      return { result, resetKey: previous.resetKey + (result.outcome === 'saved' ? 1 : 0) };
    },
    IDLE,
  );
  const form = useRef<HTMLFormElement>(null);
  const id = useId();

  useEffect(() => {
    if (state.outcome === 'saved') {
      form.current?.reset();
    }
  }, [state]);

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    startTransition(() => {
      submitAction(fields);
    });
  };

  return (
    <form
      ref={form}
      aria-labelledby={`${id}-title`}
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-300 p-4"
    >
      <h2
        id={`${id}-title`}
        className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        {en.entryForm.title}
      </h2>

      <input type="hidden" name={ENTRY_FORM_FIELDS.entryFormMode} value={mode} />

      <div className="flex flex-wrap gap-3">
        <div className={FIELD}>
          <label htmlFor={`${id}-date`}>{en.entryForm.date}</label>
          <input
            id={`${id}-date`}
            name={ENTRY_FORM_FIELDS.entryDate}
            type="date"
            required
            className={`${CONTROL} font-mono tabular-nums`}
          />
        </div>
        <div className={`${FIELD} grow`}>
          <label htmlFor={`${id}-memo`}>{en.entryForm.memo}</label>
          <input
            id={`${id}-memo`}
            name={ENTRY_FORM_FIELDS.memo}
            type="text"
            required
            className={CONTROL}
          />
        </div>
      </div>

      <Fragment key={resetKey}>{children(id)}</Fragment>

      {state.outcome === 'rejected' ? (
        <p role="alert" className="text-sm text-red-700">
          {REFUSAL[mode][state.code]}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        {pending ? en.entryForm.pending : en.entryForm.submit}
      </button>
    </form>
  );
}
