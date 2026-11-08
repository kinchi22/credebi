'use client';

import { useTranslations } from 'next-intl';
import { type ConnectionOutput } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { BUTTON, CONFIRMATION_PANEL, DANGER_BUTTON, LEGEND } from './control-classes';
import { localDayOf } from './local-day';
import { PendingDialog } from './pending-dialog';
import { DANGER_TEXT, MUTED_TEXT } from './text-classes';
import { useHydrated } from './use-hydrated';
import { useModalDialog } from './use-modal-dialog';

export type ConnectionRevocation =
  | { readonly outcome: 'revoked' }
  | { readonly outcome: 'rejected' };

export type RevokeConnectionAction = (id: string) => Promise<ConnectionRevocation>;

export type ConnectionsSectionProps = {
  readonly connections: readonly ConnectionOutput[];
  readonly action: RevokeConnectionAction;
};

const UNREVOKED: ConnectionRevocation = { outcome: 'rejected' };

function ConnectionRow({
  connection,
  onRevoke,
}: {
  readonly connection: ConnectionOutput;
  readonly onRevoke: (opener: HTMLElement) => void;
}): ReactNode {
  const t = useTranslations();
  const hydrated = useHydrated();
  const dayOf = (instant: string): string => (hydrated ? localDayOf(new Date(instant)) : '');
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0 wide:flex-row wide:items-start wide:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold wrap-anywhere">{connection.clientName}</p>
        <p className="break-all font-mono text-text-muted">{connection.redirectHosts.join(', ')}</p>
        <p className="flex flex-wrap gap-x-3">
          {connection.scopes.map((scope) => (
            <span key={scope}>{t(`consentPage.scopes.${scope}`)}</span>
          ))}
        </p>
        <p className={`flex flex-wrap gap-x-4 ${MUTED_TEXT}`}>
          <span>{t('connectionsSection.created', { day: dayOf(connection.createdAt) })}</span>
          <span>{t('connectionsSection.lastUsed', { day: dayOf(connection.lastUsedAt) })}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={(event) => {
          onRevoke(event.currentTarget);
        }}
        className={`self-start ${BUTTON}`}
      >
        {t('connectionsSection.revoke')}
      </button>
    </li>
  );
}

function RevokePanel({
  target,
  titleId,
  action,
  onDone,
  pending,
  startTransition,
}: {
  readonly target: ConnectionOutput;
  readonly titleId: string;
  readonly action: RevokeConnectionAction;
  readonly onDone: () => void;
  readonly pending: boolean;
  readonly startTransition: (scope: () => Promise<void>) => void;
}): ReactNode {
  const t = useTranslations();
  const [refused, setRefused] = useState(false);

  const confirm = (): void => {
    startTransition(async () => {
      const revocation = await action(target.id).then(
        (revoked) => revoked,
        () => UNREVOKED,
      );
      if (revocation.outcome === 'revoked') {
        onDone();
        return;
      }
      setRefused(true);
    });
  };

  return (
    <div className={CONFIRMATION_PANEL}>
      <h2 id={titleId} className={typeClasses.h2}>
        {t('connectionsSection.revokeTitle')}
      </h2>
      <div className={`flex flex-col gap-1 border-y border-border py-2 ${typeClasses['body-sm']}`}>
        <p className="font-semibold wrap-anywhere">{target.clientName}</p>
        <p className="break-all font-mono text-text-muted">{target.redirectHosts.join(', ')}</p>
      </div>
      <p className={MUTED_TEXT}>{t('connectionsSection.revokeExplained')}</p>
      {refused ? (
        <p role="alert" className={DANGER_TEXT}>
          {t('connectionsSection.notRevoked')}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <button type="button" autoFocus onClick={onDone} disabled={pending} className={BUTTON}>
          {t('connectionsSection.cancel')}
        </button>
        <button type="button" onClick={confirm} disabled={pending} className={DANGER_BUTTON}>
          {pending ? t('connectionsSection.pending') : t('connectionsSection.revoke')}
        </button>
      </div>
    </div>
  );
}

export function ConnectionsSection({ connections, action }: ConnectionsSectionProps): ReactNode {
  const t = useTranslations();
  const sectionTitleId = useId();
  const dialogTitleId = useId();
  const dialog = useModalDialog({ closesWhenWide: false });
  const [target, setTarget] = useState<ConnectionOutput>();
  const [pending, startTransition] = useTransition();

  const openRevoke = (connection: ConnectionOutput, opener: HTMLElement): void => {
    setTarget(connection);
    dialog.show(opener);
  };

  return (
    <section aria-labelledby={sectionTitleId} className="flex flex-col gap-2 border-b border-border py-5">
      <h3 id={sectionTitleId} className={LEGEND}>
        {t('connectionsSection.title')}
      </h3>
      {connections.length === 0 ? (
        <p className={MUTED_TEXT}>{t('connectionsSection.empty')}</p>
      ) : (
        <ul className={`${PANEL} flex flex-col ${typeClasses['body-sm']}`}>
          {connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              connection={connection}
              onRevoke={(opener) => {
                openRevoke(connection, opener);
              }}
            />
          ))}
        </ul>
      )}
      <PendingDialog dialog={dialog} titleId={dialogTitleId} pending={pending}>
        {target === undefined ? null : (
          <RevokePanel
            key={target.id}
            target={target}
            titleId={dialogTitleId}
            action={action}
            onDone={dialog.close}
            pending={pending}
            startTransition={startTransition}
          />
        )}
      </PendingDialog>
    </section>
  );
}
