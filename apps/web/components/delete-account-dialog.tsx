'use client';

import { type AccountType, type DomainErrorCode } from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, useTransition, type ReactNode, type TransitionStartFunction } from 'react';
import { en } from '../messages/en';
import { BUTTON, CONFIRMATION_PANEL, DANGER_BUTTON } from './control-classes';
import { type ModalDialog } from './modal-dialog';
import { PendingDialog } from './pending-dialog';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';

export type ChartDeletionOutcome =
  | { readonly outcome: 'deleted' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type ChartDeletion = (id: string) => Promise<ChartDeletionOutcome>;

export type ChartDeletions = {
  readonly deleteAccount: ChartDeletion;
  readonly deleteAccountGroup: ChartDeletion;
};

export type DeleteAccountTarget = {
  readonly kind: 'account' | 'group';
  readonly accountType: AccountType;
  readonly id: string;
  readonly name: string;
};

export type DeleteAccountDialogProps = {
  readonly dialog: ModalDialog;
  readonly target: DeleteAccountTarget | undefined;
  readonly actions: ChartDeletions;
};

const UNDELETED: ChartDeletionOutcome = { outcome: 'rejected', code: 'DEPENDENCY_UNAVAILABLE' };

const KINDS = {
  account: {
    title: en.deleteAccountDialog.title,
    refusals: en.deleteAccountDialog.refusals,
  },
  group: {
    title: en.deleteAccountDialog.groupTitle,
    refusals: en.deleteAccountDialog.groupRefusals,
  },
} as const;

function DeletePanel({
  target,
  titleId,
  actions,
  onDone,
  pending,
  startTransition,
}: {
  readonly target: DeleteAccountTarget;
  readonly titleId: string;
  readonly actions: ChartDeletions;
  readonly onDone: () => void;
  readonly pending: boolean;
  readonly startTransition: TransitionStartFunction;
}): ReactNode {
  const [refusal, setRefusal] = useState<DomainErrorCode>();
  const kind = KINDS[target.kind];
  const remove = target.kind === 'account' ? actions.deleteAccount : actions.deleteAccountGroup;

  const confirm = (): void => {
    startTransition(async () => {
      const change = await remove(target.id).then(
        (deleted) => deleted,
        () => UNDELETED,
      );
      if (change.outcome === 'deleted') {
        onDone();
        return;
      }
      setRefusal(change.code);
    });
  };

  return (
    <div className={CONFIRMATION_PANEL}>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className={typeClasses.h2}>
          {kind.title}
        </h2>
        <p className={MUTED_TEXT}>{en.accountTypes[target.accountType]}</p>
      </div>
      <p className={`border-y border-border py-2 font-semibold ${typeClasses['body-sm']}`}>
        {target.name}
      </p>
      {refusal === undefined ? null : (
        <p role="alert" className={DANGER_TEXT}>
          {kind.refusals[refusal]}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" autoFocus onClick={onDone} disabled={pending} className={BUTTON}>
          {en.deleteAccountDialog.cancel}
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={DANGER_BUTTON}>
          {pending ? en.deleteAccountDialog.pending : en.deleteAccountDialog.confirm}
        </button>
      </div>
    </div>
  );
}

export function DeleteAccountDialog({ dialog, target, actions }: DeleteAccountDialogProps): ReactNode {
  const titleId = useId();
  const [pending, startTransition] = useTransition();

  return (
    <PendingDialog dialog={dialog} titleId={titleId} pending={pending}>
      {target !== undefined ? (
        <DeletePanel
          target={target}
          titleId={titleId}
          actions={actions}
          onDone={dialog.close}
          pending={pending}
          startTransition={startTransition}
        />
      ) : null}
    </PendingDialog>
  );
}
