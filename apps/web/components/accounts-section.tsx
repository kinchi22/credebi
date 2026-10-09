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
import { GripIcon, PencilIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountDialog,
  type ChartActions,
  type AccountDialogTarget,
} from './account-dialog';
import { useBrowserToday } from './browser-today';
import { BARE_ICON_BUTTON, LEGEND, ROW_ICON_BUTTON } from './control-classes';
import { useModalDialog } from './modal-dialog';

export type AccountsSectionProps = {
  readonly chart: ChartOutput;
  readonly actions: ChartActions;
};

type Open = (target: AccountDialogTarget, opener: HTMLElement) => void;

const mayHaveEnded = (account: AccountOutput, today: string | undefined): boolean =>
  account.activeUntil !== null && (today === undefined || account.activeUntil < today);

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

function EditButton({ onEdit }: { readonly onEdit: (opener: HTMLElement) => void }): ReactNode {
  return (
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
  onEdit,
}: {
  readonly account: AccountOutput;
  readonly today: string | undefined;
  readonly onEdit: (opener: HTMLElement) => void;
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
      <EditButton onEdit={onEdit} />
    </li>
  );
}

function AccountRows({
  accounts,
  today,
  showEnded,
  open,
}: {
  readonly accounts: readonly AccountOutput[];
  readonly today: string | undefined;
  readonly showEnded: boolean;
  readonly open: Open;
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
      />
    ));
}

function GroupRow({
  group,
  onEdit,
  children,
}: {
  readonly group: AccountGroupOutput;
  readonly onEdit: (opener: HTMLElement) => void;
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
        <EditButton onEdit={onEdit} />
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
  const [target, setTarget] = useState<AccountDialogTarget>();
  const [showEnded, setShowEnded] = useState(false);

  const open: Open = (next, opener) => {
    setTarget(next);
    dialog.show(opener);
  };

  const rows = { today, showEnded, open };

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
    </section>
  );
}
