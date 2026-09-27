'use client';

import { ENTRY_FORM_FIELDS, type DomainErrorCode, type EntryFormMode } from '@repo/contracts';
import { CHART_OF_ACCOUNTS } from '@repo/core/entries';
import {
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

export type EntryFormAction = (previous: EntryFormState, form: FormData) => Promise<EntryFormState>;

export type EntryFormProps = {
  readonly action: EntryFormAction;
};

type EntryFormShellProps = EntryFormProps & {
  readonly mode: EntryFormMode;
  readonly invalid: string;
  readonly children: (id: string) => ReactNode;
};

const IDLE: EntryFormState = { outcome: 'idle' };

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

export function AmountInput({ id }: { readonly id: string }): ReactNode {
  return (
    <input
      id={id}
      name={ENTRY_FORM_FIELDS.amount}
      type="text"
      inputMode="numeric"
      pattern="[0-9]+"
      required
      className={`${CONTROL} text-right tabular-nums`}
    />
  );
}

export function EntryFormShell({
  action,
  mode,
  invalid,
  children,
}: EntryFormShellProps): ReactNode {
  const [state, submitAction, pending] = useActionState(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();

  const refusal: Readonly<Record<DomainErrorCode, string>> = {
    UNBALANCED: en.entryForm.unbalanced,
    INVALID_INPUT: invalid,
    NOT_FOUND: invalid,
    CONFLICT: en.entryForm.unavailable,
    DEPENDENCY_UNAVAILABLE: en.entryForm.unavailable,
    UNAUTHENTICATED: en.entryForm.signedOut,
  };

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
            className={CONTROL}
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

      {children(id)}

      {state.outcome === 'rejected' ? (
        <p role="alert" className="text-sm text-red-700">
          {refusal[state.code]}
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
