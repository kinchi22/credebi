'use client';

import { ENTRY_FORM_FIELDS, type DomainErrorCode, type EntryFormMode } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
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
import { useBrowserToday } from './browser-today';
import { CONTROL, DENSE_FIELD, PRIMARY_BUTTON } from './control-classes';

export type EntryFormState =
  | { readonly outcome: 'idle' }
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

type EntryFormAction = (previous: EntryFormState, form: FormData) => Promise<EntryFormState>;

export type EntryFormProps = {
  readonly action: EntryFormAction;
};

export type EntryFormParts = {
  readonly id: string;
  readonly heading: ReactNode;
  readonly refusal: ReactNode;
  readonly submitButton: ReactNode;
};

type EntryFormShellProps = EntryFormProps & {
  readonly mode: EntryFormMode;
  readonly children: (parts: EntryFormParts) => ReactNode;
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
      className={`${CONTROL} text-right ${typeClasses.figure}`}
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
  const today = useBrowserToday();

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

  const heading = (
    <>
      <h2 id={`${id}-title`} className={`${typeClasses.label} text-text-muted`}>
        {en.entryForm.title}
      </h2>

      <div className="flex flex-wrap gap-3">
        <div className={DENSE_FIELD}>
          <label htmlFor={`${id}-date`}>{en.entryForm.date}</label>
          <input
            id={`${id}-date`}
            name={ENTRY_FORM_FIELDS.entryDate}
            type="date"
            defaultValue={today}
            required
            className={`${CONTROL} ${typeClasses.date}`}
          />
        </div>
        <div className={`${DENSE_FIELD} grow`}>
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
    </>
  );

  const refusal =
    state.outcome === 'rejected' ? (
      <p role="alert" className={`min-w-0 flex-1 text-danger ${typeClasses['body-dense']}`}>
        {REFUSAL[mode][state.code]}
      </p>
    ) : null;

  const submitButton = (
    <button type="submit" disabled={pending} className={`shrink-0 ${PRIMARY_BUTTON}`}>
      {pending ? en.entryForm.pending : en.entryForm.submit}
    </button>
  );

  return (
    <form
      ref={form}
      aria-labelledby={`${id}-title`}
      onSubmit={submit}
      className={`flex flex-col gap-3 ${PANEL}`}
    >
      <input type="hidden" name={ENTRY_FORM_FIELDS.entryFormMode} value={mode} />

      <Fragment key={resetKey}>{children({ id, heading, refusal, submitButton })}</Fragment>
    </form>
  );
}
