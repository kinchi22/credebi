'use client';

import { useTranslations } from 'next-intl';
import { type ConnectionOutput } from '@repo/contracts';
import { PANEL, UnlinkIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { ConfirmationPanel } from './confirmation-panel';
import { ConnectionDialog } from './connection-dialog';
import { BUTTON, DANGER_ICON_BUTTON, LEGEND, PRIMARY_BUTTON } from './control-classes';
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
  readonly mcpUrl: string;
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

function ScopeChips({ scopes }: { readonly scopes: ConnectionOutput['scopes'] }): ReactNode {
  const t = useTranslations();
  return (
    <p className="flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <span
          key={scope}
          className={`rounded-control border px-1.5 ${typeClasses['body-dense']} ${scope === 'write' ? 'border-accent-text text-accent-text' : 'border-border text-text-muted'}`}
        >
          {t(`connectionsSection.scopes.${scope}`)}
        </span>
      ))}
    </p>
  );
}

function ConnectionCard({
  connection,
  onRevoke,
}: {
  readonly connection: ConnectionOutput;
  readonly onRevoke: (opener: HTMLElement) => void;
}): ReactNode {
  const t = useTranslations();
  return (
    <li className={`${PANEL} flex min-w-0 flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="font-semibold wrap-anywhere">{connection.clientName}</p>
          <p className="break-all text-text-muted">{connection.redirectHost}</p>
        </div>
        <button
          type="button"
          aria-label={t('connectionsSection.revokeNamed', { client: connection.clientName })}
          onClick={(event) => {
            onRevoke(event.currentTarget);
          }}
          className={DANGER_ICON_BUTTON}
        >
          <UnlinkIcon />
        </button>
      </div>
      <ScopeChips scopes={connection.scopes} />
      <p className={`flex flex-wrap gap-x-4 ${MUTED_TEXT}`}>
        <ShownDay label={t('connectionsSection.created')} instant={connection.createdAt} />
        <ShownDay label={t('connectionsSection.lastUsed')} instant={connection.lastUsedAt} />
      </p>
    </li>
  );
}

function EmptyConnections({ onStart }: { readonly onStart: (opener: HTMLElement) => void }): ReactNode {
  const t = useTranslations();
  return (
    <div className={`${PANEL} flex flex-col items-center gap-3 py-8 text-center wide:py-8 ${typeClasses['body-sm']}`}>
      <p className="font-semibold">{t('connectionsSection.emptyTitle')}</p>
      <p className="max-w-96 text-text-muted">{t('connectionsSection.emptyBody')}</p>
      <button
        type="button"
        onClick={(event) => {
          onStart(event.currentTarget);
        }}
        className={PRIMARY_BUTTON}
      >
        {t('connectionsSection.startConnecting')}
      </button>
    </div>
  );
}

export function ConnectionsSection({ connections, mcpUrl, action }: ConnectionsSectionProps): ReactNode {
  const t = useTranslations();
  const sectionTitleId = useId();
  const dialogTitleId = useId();
  const dialog = useModalDialog({ closesWhenWide: false });
  const connecting = useModalDialog({ closesWhenWide: false });
  const [target, setTarget] = useState<ConnectionOutput>();
  const [pending, startTransition] = useTransition();
  const notRevoked = t('connectionsSection.notRevoked');

  return (
    <section aria-labelledby={sectionTitleId} className="flex flex-col gap-3 border-b border-border py-5">
      <div className="flex min-h-control items-center justify-between gap-2">
        <h3 id={sectionTitleId} className={LEGEND}>
          {t('connectionsSection.title')}
        </h3>
        {connections.length === 0 ? null : (
          <button
            type="button"
            aria-label={t('connectionsSection.addConnection')}
            onClick={(event) => {
              connecting.show(event.currentTarget);
            }}
            className={BUTTON}
          >
            {t('connectionsSection.addConnectionText')}
          </button>
        )}
      </div>
      {connections.length === 0 ? (
        <EmptyConnections onStart={connecting.show} />
      ) : (
        <ul className={`grid gap-3 wide:grid-cols-2 ${typeClasses['body-sm']}`}>
          {connections.map((connection) => (
            <ConnectionCard
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
      <ConnectionDialog dialog={connecting} mcpUrl={mcpUrl} />
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
