'use client';

import {
  ACCOUNT_FORM_FIELDS,
  type AccountGroupOutput,
  type AccountOutput,
  type AccountType,
  type DomainErrorCode,
} from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import {
  useId,
  useState,
  useTransition,
  type ReactNode,
  type SubmitEvent,
  type TransitionStartFunction,
} from 'react';
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

export type AccountAction = (
  accountTypeOrId: string,
  form: FormData,
) => Promise<AccountChange>;

export type AccountActions = {
  readonly addAccount: AccountAction;
  readonly editAccount: AccountAction;
  readonly addAccountGroup: AccountAction;
  readonly editAccountGroup: AccountAction;
};

export type AccountDialogTarget =
  | { readonly kind: 'add-account'; readonly accountType: AccountType }
  | { readonly kind: 'edit-account'; readonly account: AccountOutput }
  | { readonly kind: 'add-group'; readonly accountType: AccountType }
  | { readonly kind: 'edit-group'; readonly group: AccountGroupOutput };

export type AccountDialogProps = {
  readonly dialog: ModalDialog;
  readonly target: AccountDialogTarget | undefined;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
  readonly actions: AccountActions;
};

const UNSAVED: AccountChange = { outcome: 'rejected', code: 'DEPENDENCY_UNAVAILABLE' };

const TITLES: Readonly<Record<AccountDialogTarget['kind'], string>> = {
  'add-account': en.accountDialog.addTitle,
  'edit-account': en.accountDialog.editTitle,
  'add-group': en.accountDialog.addGroupTitle,
  'edit-group': en.accountDialog.editGroupTitle,
};

function accountTypeOf(target: AccountDialogTarget): AccountType {
  switch (target.kind) {
    case 'edit-account':
      return target.account.accountType;
    case 'edit-group':
      return target.group.accountType;
    default:
      return target.accountType;
  }
}

function saverOf(
  target: AccountDialogTarget,
  actions: AccountActions,
): (form: FormData) => Promise<AccountChange> {
  switch (target.kind) {
    case 'add-account':
      return actions.addAccount.bind(null, target.accountType);
    case 'edit-account':
      return actions.editAccount.bind(null, target.account.id);
    case 'add-group':
      return actions.addAccountGroup.bind(null, target.accountType);
    case 'edit-group':
      return actions.editAccountGroup.bind(null, target.group.id);
  }
}

const isAccount = (target: AccountDialogTarget): boolean =>
  target.kind === 'add-account' || target.kind === 'edit-account';

function AccountFields({
  account,
  accountType,
  groups,
  today,
}: {
  readonly account: AccountOutput | undefined;
  readonly accountType: AccountType;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
}): ReactNode {
  return (
    <>
      <label className={FIELD}>
        {en.accountDialog.group}
        <select
          name={ACCOUNT_FORM_FIELDS.group}
          defaultValue={account?.groupId ?? ''}
          className={CONTROL}
        >
          <option value="">{en.accountDialog.noGroup}</option>
          {groups
            .filter((group) => group.accountType === accountType)
            .map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
        </select>
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
    </>
  );
}

function AccountForm({
  target,
  groups,
  today,
  titleId,
  onCancel,
  onSaved,
  save,
  pending,
  startTransition,
}: {
  readonly target: AccountDialogTarget;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
  readonly titleId: string;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
  readonly save: (form: FormData) => Promise<AccountChange>;
  readonly pending: boolean;
  readonly startTransition: TransitionStartFunction;
}): ReactNode {
  const [refusal, setRefusal] = useState<DomainErrorCode>();
  const account = target.kind === 'edit-account' ? target.account : undefined;
  const described = target.kind === 'edit-group' ? target.group : account;
  const refusals = isAccount(target) ? en.accountDialog.refusals : en.accountDialog.groupRefusals;

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
          {TITLES[target.kind]}
        </h2>
        <p className={MUTED_TEXT}>{en.accountTypes[accountTypeOf(target)]}</p>
      </div>
      <label className={FIELD}>
        {en.accountDialog.name}
        <input
          name={ACCOUNT_FORM_FIELDS.name}
          required
          autoFocus
          defaultValue={described?.name}
          className={CONTROL}
        />
      </label>
      <label className={FIELD}>
        {en.accountDialog.description}
        <textarea
          name={ACCOUNT_FORM_FIELDS.description}
          rows={2}
          defaultValue={described?.description ?? ''}
          className={CONTROL}
        />
      </label>
      {isAccount(target) ? (
        <AccountFields
          account={account}
          accountType={accountTypeOf(target)}
          groups={groups}
          today={today}
        />
      ) : null}
      {refusal === undefined ? null : (
        <p role="alert" className={DANGER_TEXT}>
          {refusals[refusal]}
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
  groups,
  today,
  actions,
}: AccountDialogProps): ReactNode {
  const titleId = useId();
  const [pending, startTransition] = useTransition();

  return (
    <dialog
      {...dialog.dialogProps}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (pending) {
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        if (!pending) {
          dialog.closeOnScrim(event);
        }
      }}
      className={CONFIRMATION_DIALOG}
    >
      {dialog.open && target !== undefined ? (
        <AccountForm
          target={target}
          groups={groups}
          today={today}
          titleId={titleId}
          onCancel={dialog.close}
          onSaved={dialog.close}
          save={saverOf(target, actions)}
          pending={pending}
          startTransition={startTransition}
        />
      ) : null}
    </dialog>
  );
}
