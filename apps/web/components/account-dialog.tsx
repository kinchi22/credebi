'use client';

import {
  ACCOUNT_FORM_FIELDS,
  type AccountOutput,
  type AccountType,
  type DomainErrorCode,
} from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, useTransition, type ReactNode, type SubmitEvent } from 'react';
import { en } from '../messages/en';
import {
  BUTTON,
  CONFIRMATION_DIALOG,
  CONFIRMATION_PANEL,
  CONTROL,
  DATE_CONTROL,
  FIELD,
  PRIMARY_BUTTON,
} from './control-classes';
import { type ModalDialog } from './modal-dialog';
import { MUTED_TEXT, DANGER_TEXT } from './text-classes';

export type AccountChange =
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type AccountAction = (key: string, form: FormData) => Promise<AccountChange>;

export type AccountDialogTarget =
  | { readonly kind: 'add'; readonly accountType: AccountType }
  | { readonly kind: 'edit'; readonly account: AccountOutput };

export type AccountDialogProps = {
  readonly dialog: ModalDialog;
  readonly target: AccountDialogTarget | undefined;
  readonly today: string | undefined;
  readonly addAction: AccountAction;
  readonly editAction: AccountAction;
};

const UNSAVED: AccountChange = { outcome: 'rejected', code: 'DEPENDENCY_UNAVAILABLE' };

const accountTypeOf = (target: AccountDialogTarget): AccountType =>
  target.kind === 'add' ? target.accountType : target.account.accountType;

function AccountForm({
  target,
  today,
  titleId,
  onCancel,
  onSaved,
  save,
}: {
  readonly target: AccountDialogTarget;
  readonly today: string | undefined;
  readonly titleId: string;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
  readonly save: (form: FormData) => Promise<AccountChange>;
}): ReactNode {
  const [refusal, setRefusal] = useState<DomainErrorCode>();
  const [pending, startTransition] = useTransition();
  const account = target.kind === 'edit' ? target.account : undefined;

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const change = await save(form).then(
        (saved) => saved,
        () => UNSAVED,
      );
      if (change.outcome === 'saved') {
        onSaved();
        return;
      }
      setRefusal(change.code);
    });
  };

  return (
    <form onSubmit={submit} className={CONFIRMATION_PANEL}>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className={typeClasses.h2}>
          {account === undefined ? en.accountDialog.addTitle : en.accountDialog.editTitle}
        </h2>
        <p className={MUTED_TEXT}>{en.accountTypes[accountTypeOf(target)]}</p>
      </div>
      <label className={FIELD}>
        {en.accountDialog.name}
        <input
          name={ACCOUNT_FORM_FIELDS.name}
          required
          autoFocus
          defaultValue={account?.name}
          className={CONTROL}
        />
      </label>
      <label className={FIELD}>
        {en.accountDialog.description}
        <textarea
          name={ACCOUNT_FORM_FIELDS.description}
          rows={2}
          defaultValue={account?.description ?? ''}
          className={CONTROL}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className={`${FIELD} min-w-0 flex-1`}>
          {en.accountDialog.activeFrom}
          <input
            type="date"
            name={ACCOUNT_FORM_FIELDS.activeFrom}
            required
            defaultValue={account?.activeFrom ?? today}
            className={DATE_CONTROL}
          />
        </label>
        <label className={`${FIELD} min-w-0 flex-1`}>
          {en.accountDialog.activeUntil}
          <input
            type="date"
            name={ACCOUNT_FORM_FIELDS.activeUntil}
            defaultValue={account?.activeUntil ?? ''}
            className={DATE_CONTROL}
          />
        </label>
      </div>
      {refusal === undefined ? null : (
        <p role="alert" className={DANGER_TEXT}>
          {en.accountDialog.refusals[refusal]}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={pending} className={BUTTON}>
          {en.accountDialog.cancel}
        </button>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? en.accountDialog.pending : en.accountDialog.save}
        </button>
      </div>
    </form>
  );
}

export function AccountDialog({
  dialog,
  target,
  today,
  addAction,
  editAction,
}: AccountDialogProps): ReactNode {
  const titleId = useId();

  return (
    <dialog
      {...dialog.dialogProps}
      aria-labelledby={titleId}
      onClick={dialog.closeOnScrim}
      className={CONFIRMATION_DIALOG}
    >
      {dialog.open && target !== undefined ? (
        <AccountForm
          target={target}
          today={today}
          titleId={titleId}
          onCancel={dialog.close}
          onSaved={dialog.close}
          save={
            target.kind === 'edit'
              ? editAction.bind(null, target.account.id)
              : addAction.bind(null, target.accountType)
          }
        />
      ) : null}
    </dialog>
  );
}
