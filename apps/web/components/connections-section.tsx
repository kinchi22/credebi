'use client';

import { useTranslations } from 'next-intl';
import { type ConnectionOutput } from '@repo/contracts';
import { PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { ConfirmationPanel } from './confirmation-panel';
import { BUTTON, LEGEND } from './control-classes';
import { localDayOf } from './local-day';
import { PendingDialog } from './pending-dialog';
import { MUTED_TEXT } from './text-classes';
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

function ShownDay({ label, instant }: { readonly label: string; readonly instant: string }): ReactNode {
  const hydrated = useHydrated();
  return (
    <span>
      {label}{' '}
      <time dateTime={instant} className={typeClasses.date}>
        {hydrated ? localDayOf(new Date(instant)) : ''}
      </time>
    </span>
  );
}

function ConnectionRow({
  connection,
  onRevoke,
}: {
  readonly connection: ConnectionOutput;
  readonly onRevoke: (opener: HTMLElement) => void;
}): ReactNode {
  const t = useTranslations();
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0 wide:flex-row wide:items-start wide:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold wrap-anywhere">{connection.clientName}</p>
        <p className="break-all text-text-muted">{connection.redirectHost}</p>
        <p className="flex flex-wrap gap-x-3">
          {connection.scopes.map((scope) => (
            <span key={scope}>{t(`connectionsSection.scopes.${scope}`)}</span>
          ))}
        </p>
        <p className={`flex flex-wrap gap-x-4 ${MUTED_TEXT}`}>
          <ShownDay label={t('connectionsSection.created')} instant={connection.createdAt} />
          <ShownDay label={t('connectionsSection.lastUsed')} instant={connection.lastUsedAt} />
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

export function ConnectionsSection({ connections, action }: ConnectionsSectionProps): ReactNode {
  const t = useTranslations();
  const sectionTitleId = useId();
  const dialogTitleId = useId();
  const dialog = useModalDialog({ closesWhenWide: false });
  const [target, setTarget] = useState<ConnectionOutput>();
  const [pending, startTransition] = useTransition();
  const notRevoked = t('connectionsSection.notRevoked');

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
                setTarget(connection);
                dialog.show(opener);
              }}
            />
          ))}
        </ul>
      )}
      <PendingDialog dialog={dialog} titleId={dialogTitleId} pending={pending}>
        {target === undefined ? null : (
          <ConfirmationPanel
            titleId={dialogTitleId}
            title={t('connectionsSection.revokeTitle')}
            cancel={t('connectionsSection.cancel')}
            confirm={t('connectionsSection.revoke')}
            confirming={t('connectionsSection.pending')}
            unavailable={notRevoked}
            act={async () => {
              const revocation = await action(target.id);
              return revocation.outcome === 'revoked' ? undefined : notRevoked;
            }}
            onDone={dialog.close}
            pending={pending}
            startTransition={startTransition}
          >
            <p className="font-semibold wrap-anywhere">{target.clientName}</p>
            <p className="break-all text-text-muted">{target.redirectHost}</p>
          </ConfirmationPanel>
        )}
      </PendingDialog>
    </section>
  );
}
