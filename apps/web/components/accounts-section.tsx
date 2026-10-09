'use client';

import {
  accountTypeSchema,
  groupsIn,
  nodesOfType,
  type AccountGroupOutput,
  type AccountOutput,
  type AccountType,
  type ChartOutput,
} from '@repo/contracts';
import { hasEndedBy } from '@repo/core/accounts';
import { GripIcon, PencilIcon, TrashIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountDialog,
  type ChartActions,
  type AccountDialogTarget,
} from './account-dialog';
import { useBrowserToday } from './browser-today';
import {
  DeleteAccountDialog,
  type ChartDeletions,
  type DeleteAccountTarget,
} from './delete-account-dialog';
import { BARE_ICON_BUTTON, LEGEND, ROW_ICON_BUTTON } from './control-classes';
import { useModalDialog } from './modal-dialog';

export type AccountsSectionProps = {
  readonly chart: ChartOutput;
  readonly actions: ChartActions & ChartDeletions;
};

type Open = (target: AccountDialogTarget, opener: HTMLElement) => void;

type OpenDelete = (target: DeleteAccountTarget, opener: HTMLElement) => void;

type RowActions = {
  readonly onEdit: (opener: HTMLElement) => void;
  readonly onDelete: (opener: HTMLElement) => void;
};

const mayHaveEnded = (account: AccountOutput, today: string | undefined): boolean =>
  today === undefined ? account.activeUntil !== null : hasEndedBy(account, today);

const startsLater = (account: AccountOutput, today: string | undefined): boolean =>
  today !== undefined && account.activeFrom > today;

const BAND_BUTTON = 'text-accent-text hover:underline';

function Grip({ name }: { readonly name: string }): ReactNode {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${en.accountsSection.move} ${name}`}
      className={`${BARE_ICON_BUTTON} shrink-0 cursor-grab`}
    >
      <GripIcon />
    </button>
  );
}

function RowButtons({ onEdit, onDelete }: RowActions): ReactNode {
  return (
    <>
      <button
        type="button"
        aria-label={en.accountsSection.edit}
        onClick={(event) => {
          onEdit(event.currentTarget);
        }}
        className={ROW_ICON_BUTTON}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        aria-label={en.accountsSection.delete}
        onClick={(event) => {
          onDelete(event.currentTarget);
        }}
        className={ROW_ICON_BUTTON}
      >
        <TrashIcon />
      </button>
    </>
  );
}

function Description({ text }: { readonly text: string | null }): ReactNode {
  return text === null ? null : (
    <span className={`${typeClasses['body-dense']} text-text-muted`}>{text}</span>
  );
}

function AccountRow({
  account,
  today,
  ...actions
}: RowActions & {
  readonly account: AccountOutput;
  readonly today: string | undefined;
}): ReactNode {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Grip name={account.name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span>
          {account.name}
          {startsLater(account, today) ? (
            <span className={`ml-2 ${typeClasses.date} text-text-muted`}>
              {en.accountsSection.startsOn}{' '}
              <time dateTime={account.activeFrom}>{account.activeFrom}</time>
            </span>
          ) : null}
        </span>
        <Description text={account.description} />
      </span>
      <RowButtons {...actions} />
    </li>
  );
}

function AccountRows({
  accounts,
  today,
  showEnded,
  open,
  openDelete,
}: {
  readonly accounts: readonly AccountOutput[];
  readonly today: string | undefined;
  readonly showEnded: boolean;
  readonly open: Open;
  readonly openDelete: OpenDelete;
}): ReactNode {
  return accounts
    .filter((account) => showEnded || !mayHaveEnded(account, today))
    .map((account) => (
      <AccountRow
        key={account.id}
        account={account}
        today={today}
        onEdit={(opener) => {
          open({ kind: 'account', accountType: account.accountType, editing: account }, opener);
        }}
        onDelete={(opener) => {
          openDelete(
            { kind: 'account', accountType: account.accountType, id: account.id, name: account.name },
            opener,
          );
        }}
      />
    ));
}

function GroupRow({
  group,
  children,
  ...actions
}: RowActions & {
  readonly group: AccountGroupOutput;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <li>
      <div className="flex items-center gap-2 py-1.5">
        <Grip name={group.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{group.name}</span>
          <Description text={group.description} />
        </span>
        <RowButtons {...actions} />
      </div>
      <ul className="pl-6">{children}</ul>
    </li>
  );
}

function TypeBand({
  accountType,
  id,
  open,
}: {
  readonly accountType: AccountType;
  readonly id: string;
  readonly open: Open;
}): ReactNode {
  return (
    <div className="flex items-center justify-between gap-3 bg-band px-2 py-1">
      <span id={id} className={`${typeClasses.label} text-text-muted`}>
        {en.accountTypes[accountType]}
      </span>
      <span className="flex gap-3">
        <button
          type="button"
          aria-label={en.accountsSection.addAccount}
          onClick={(event) => {
            open({ kind: 'account', accountType, editing: undefined }, event.currentTarget);
          }}
          className={BAND_BUTTON}
        >
          {en.accountsSection.addAccountText}
        </button>
        <button
          type="button"
          aria-label={en.accountsSection.addGroup}
          onClick={(event) => {
            open({ kind: 'group', accountType, editing: undefined }, event.currentTarget);
          }}
          className={BAND_BUTTON}
        >
          {en.accountsSection.addGroupText}
        </button>
      </span>
    </div>
  );
}

export function AccountsSection({ chart, actions }: AccountsSectionProps): ReactNode {
  const titleId = useId();
  const bandId = useId();
  const today = useBrowserToday();
  const dialog = useModalDialog({ closesWhenWide: false });
  const deleteDialog = useModalDialog({ closesWhenWide: false });
  const [target, setTarget] = useState<AccountDialogTarget>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteAccountTarget>();
  const [showEnded, setShowEnded] = useState(false);

  const open: Open = (next, opener) => {
    setTarget(next);
    dialog.show(opener);
  };

  const openDelete: OpenDelete = (next, opener) => {
    setDeleteTarget(next);
    deleteDialog.show(opener);
  };

  const rows = { today, showEnded, open, openDelete };

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className={LEGEND}>
          {en.accountsSection.title}
        </h3>
        <label className={`flex items-center gap-2 ${typeClasses['body-sm']}`}>
          <input
            type="checkbox"
            checked={showEnded}
            onChange={(event) => {
              setShowEnded(event.currentTarget.checked);
            }}
          />
          {en.accountsSection.showEnded}
        </label>
      </div>
      <div className={`flex flex-col gap-4 ${typeClasses['body-sm']}`}>
        {accountTypeSchema.options.map((accountType) => (
          <div key={accountType} role="group" aria-labelledby={`${bandId}-${accountType}`}>
            <TypeBand accountType={accountType} id={`${bandId}-${accountType}`} open={open} />
            <ul className="px-2">
              {nodesOfType(chart, accountType).map((node) =>
                  node.kind === 'account' ? (
                    <AccountRows key={node.account.id} accounts={[node.account]} {...rows} />
                  ) : (
                    <GroupRow
                      key={node.group.id}
                      group={node.group}
                      onEdit={(opener) => {
                        open({ kind: 'group', accountType, editing: node.group }, opener);
                      }}
                      onDelete={(opener) => {
                        openDelete(
                          { kind: 'group', accountType, id: node.group.id, name: node.group.name },
                          opener,
                        );
                      }}
                    >
                      <AccountRows accounts={node.accounts} {...rows} />
                    </GroupRow>
                  ),
                )}
            </ul>
          </div>
        ))}
      </div>
      <AccountDialog
        dialog={dialog}
        target={target}
        groups={groupsIn(chart)}
        today={today}
        actions={actions}
      />
      <DeleteAccountDialog dialog={deleteDialog} target={deleteTarget} actions={actions} />
    </section>
  );
}
