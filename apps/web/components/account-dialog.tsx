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
  CONFIRMATION_DIALOG,
  CONFIRMATION_PANEL,
  CONTROL,
  DATE_CONTROL,
  FIELD,
  PRIMARY_BUTTON,
} from './control-classes';
import { DiscardChanges, useChangeGuard } from './discard-changes';
import { type ModalDialog } from './modal-dialog';
import { SheetCloseButton } from './sheet';
import { MUTED_TEXT, DANGER_TEXT } from './text-classes';

export type ChartChange =
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type ChartAction = (accountTypeOrId: string, form: FormData) => Promise<ChartChange>;

export type ChartActions = {
  readonly addAccount: ChartAction;
  readonly editAccount: ChartAction;
  readonly addAccountGroup: ChartAction;
  readonly editAccountGroup: ChartAction;
};

export type AccountDialogTarget =
  | {
      readonly kind: 'account';
      readonly accountType: AccountType;
      readonly editing: AccountOutput | undefined;
    }
  | {
      readonly kind: 'group';
      readonly accountType: AccountType;
      readonly editing: AccountGroupOutput | undefined;
    };

export type AccountDialogProps = {
  readonly dialog: ModalDialog;
  readonly target: AccountDialogTarget | undefined;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
  readonly actions: ChartActions;
};

const UNSAVED: ChartChange = { outcome: 'rejected', code: 'DEPENDENCY_UNAVAILABLE' };

const KINDS = {
  account: {
    addTitle: en.accountDialog.addTitle,
    editTitle: en.accountDialog.editTitle,
    refusals: en.accountDialog.refusals,
    discardBody: en.accountDialog.discardBody,
  },
  group: {
    addTitle: en.accountDialog.addGroupTitle,
    editTitle: en.accountDialog.editGroupTitle,
    refusals: en.accountDialog.groupRefusals,
    discardBody: en.accountDialog.discardGroupBody,
  },
} as const;

function saverOf(
  target: AccountDialogTarget,
  actions: ChartActions,
): (form: FormData) => Promise<ChartChange> {
  const [add, edit] =
    target.kind === 'account'
      ? [actions.addAccount, actions.editAccount]
      : [actions.addAccountGroup, actions.editAccountGroup];
  return target.editing === undefined
    ? add.bind(null, target.accountType)
    : edit.bind(null, target.editing.id);
}

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
  const groupId = useId();

  return (
    <>
      <div className={FIELD}>
        <label htmlFor={groupId}>{en.accountDialog.group}</label>
        <select
          id={groupId}
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
      </div>
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
  onClose,
  onSaved,
  save,
  pending,
  startTransition,
}: {
  readonly target: AccountDialogTarget;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly save: (form: FormData) => Promise<ChartChange>;
  readonly pending: boolean;
  readonly startTransition: TransitionStartFunction;
}): ReactNode {
  const [refusal, setRefusal] = useState<DomainErrorCode>();
  const descriptionId = useId();
  const kind = KINDS[target.kind];
  const described = target.editing;

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
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className={typeClasses.h2}>
            {described === undefined ? kind.addTitle : kind.editTitle}
          </h2>
          <p className={MUTED_TEXT}>{en.accountTypes[target.accountType]}</p>
        </div>
        <SheetCloseButton label={en.accountDialog.close} onClose={onClose} disabled={pending} />
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
      <div className={FIELD}>
        <label htmlFor={descriptionId}>{en.accountDialog.description}</label>
        <textarea
          id={descriptionId}
          name={ACCOUNT_FORM_FIELDS.description}
          rows={2}
          defaultValue={described?.description ?? ''}
          className={CONTROL}
        />
      </div>
      {target.kind === 'account' ? (
        <AccountFields
          account={target.editing}
          accountType={target.accountType}
          groups={groups}
          today={today}
        />
      ) : null}
      {refusal === undefined ? null : (
        <p role="alert" className={DANGER_TEXT}>
          {kind.refusals[refusal]}
        </p>
      )}
      <div className="flex justify-end gap-3">
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
  const guard = useChangeGuard(dialog, pending);

  return (
    <>
      <dialog
        {...dialog.dialogProps}
        {...guard.dialogHandlers}
        aria-labelledby={titleId}
        className={CONFIRMATION_DIALOG}
      >
        {dialog.open && target !== undefined ? (
          <AccountForm
            target={target}
            groups={groups}
            today={today}
            titleId={titleId}
            onClose={guard.requestClose}
            onSaved={dialog.close}
            save={saverOf(target, actions)}
            pending={pending}
            startTransition={startTransition}
          />
        ) : null}
      </dialog>
      <DiscardChanges
        dialog={guard.discard}
        body={target === undefined ? '' : KINDS[target.kind].discardBody}
        onDiscard={guard.discardChanges}
      />
    </>
  );
}
