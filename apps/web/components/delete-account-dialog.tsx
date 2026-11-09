'use client';

import { useTranslations } from 'next-intl';
import { type AccountType, type DomainErrorCode } from '@repo/contracts';
import { useId, useTransition, type ReactNode, type TransitionStartFunction } from 'react';
import { ConfirmationPanel } from './confirmation-panel';
import { type ModalDialog } from './use-modal-dialog';
import { PendingDialog } from './pending-dialog';

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

const KINDS = {
  account: {
    title: 'deleteAccountDialog.title',
    refusals: 'deleteAccountDialog.refusals',
  },
  group: {
    title: 'deleteAccountDialog.groupTitle',
    refusals: 'deleteAccountDialog.groupRefusals',
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
  const t = useTranslations();
  const kind = KINDS[target.kind];
  const remove = target.kind === 'account' ? actions.deleteAccount : actions.deleteAccountGroup;
  const refusalOf = (code: DomainErrorCode): string => t(`${kind.refusals}.${code}`);

  return (
    <ConfirmationPanel
      titleId={titleId}
      title={t(kind.title)}
      subtitle={t(`accountTypes.${target.accountType}`)}
      cancel={t('deleteAccountDialog.cancel')}
      confirm={t('deleteAccountDialog.confirm')}
      confirming={t('deleteAccountDialog.pending')}
      unavailable={refusalOf('DEPENDENCY_UNAVAILABLE')}
      act={async () => {
        const change = await remove(target.id);
        return change.outcome === 'deleted' ? undefined : refusalOf(change.code);
      }}
      onDone={onDone}
      pending={pending}
      startTransition={startTransition}
    >
      <p className="font-semibold wrap-anywhere">{target.name}</p>
    </ConfirmationPanel>
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
