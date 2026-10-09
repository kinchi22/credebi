'use client';

import {
  accountTypeSchema,
  groupsIn,
  movedInChart,
  nodesOfType,
  type AccountGroupOutput,
  type AccountOutput,
  type AccountType,
  type ChartOutput,
  type DomainErrorCode,
  type MoveChartNodeInput,
} from '@repo/contracts';
import { hasEndedBy } from '@repo/core/accounts';
import { PencilIcon, TrashIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useOptimistic, useState, useTransition, type ReactNode } from 'react';
import { en } from '../messages/en';
import {
  AccountDialog,
  type ChartActions,
  type ChartChange,
  type AccountDialogTarget,
} from './account-dialog';
import { ChartDrag, SortableItem, SortableList, type ChartPlace } from './chart-drag';
import { useBrowserToday } from './browser-today';
import {
  DeleteAccountDialog,
  type ChartDeletions,
  type DeleteAccountTarget,
} from './delete-account-dialog';
import { LEGEND, ROW_ICON_BUTTON } from './control-classes';
import { useModalDialog } from './modal-dialog';
import { DANGER_TEXT } from './text-classes';

export type AccountsSectionProps = {
  readonly chart: ChartOutput;
  readonly actions: ChartActions &
    ChartDeletions & {
      readonly moveChartNode: (move: MoveChartNodeInput) => Promise<ChartChange>;
    };
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

const UNMOVED: ChartChange = { outcome: 'rejected', code: 'DEPENDENCY_UNAVAILABLE' };

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
    <SortableItem
      node={{ kind: 'account', id: account.id }}
      place={{ accountType: account.accountType, groupId: account.groupId }}
      name={account.name}
      className="flex items-center gap-2 py-1.5"
    >
      {(grip) => (
        <>
          {grip}
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
        </>
      )}
    </SortableItem>
  );
}

type Rows = {
  readonly today: string | undefined;
  readonly showEnded: boolean;
  readonly open: Open;
  readonly openDelete: OpenDelete;
};

const shownAccounts = (
  accounts: readonly AccountOutput[],
  { showEnded, today }: Pick<Rows, 'showEnded' | 'today'>,
): AccountOutput[] => accounts.filter((account) => showEnded || !mayHaveEnded(account, today));

function AccountRows({
  accounts,
  open,
  openDelete,
  ...shown
}: Rows & {
  readonly accounts: readonly AccountOutput[];
}): ReactNode {
  return shownAccounts(accounts, shown).map((account) => (
    <AccountRow
      key={account.id}
      account={account}
      today={shown.today}
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
  shownIds,
  children,
  ...actions
}: RowActions & {
  readonly group: AccountGroupOutput;
  readonly shownIds: readonly string[];
  readonly children: ReactNode;
}): ReactNode {
  return (
    <SortableItem
      node={{ kind: 'group', id: group.id }}
      place={{ accountType: group.accountType, groupId: null }}
      name={group.name}
      className=""
    >
      {(grip) => (
        <>
          <div className="flex items-center gap-2 py-1.5">
            {grip}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{group.name}</span>
              <Description text={group.description} />
            </span>
            <RowButtons {...actions} />
          </div>
          <SortableList
            place={{ accountType: group.accountType, groupId: group.id }}
            ids={shownIds}
            className={shownIds.length === 0 ? 'min-h-8 pl-6' : 'pl-6'}
          >
            {children}
          </SortableList>
        </>
      )}
    </SortableItem>
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

const shownIdsOf = (nodes: ChartOutput, rows: Rows): string[] =>
  nodes.flatMap((node) =>
    node.kind === 'group'
      ? [node.group.id]
      : shownAccounts([node.account], rows).map((account): string => account.id),
  );

function TypeList({
  accountType,
  chart,
  rows,
}: {
  readonly accountType: AccountType;
  readonly chart: ChartOutput;
  readonly rows: Rows;
}): ReactNode {
  const { open, openDelete } = rows;
  const nodes = nodesOfType(chart, accountType);
  const place: ChartPlace = { accountType, groupId: null };

  return (
    <SortableList place={place} ids={shownIdsOf(nodes, rows)} className="px-2">
      {nodes.map((node) =>
        node.kind === 'account' ? (
          <AccountRows key={node.account.id} accounts={[node.account]} {...rows} />
        ) : (
          <GroupRow
            key={node.group.id}
            group={node.group}
            shownIds={shownAccounts(node.accounts, rows).map((account) => account.id)}
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
    </SortableList>
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
  const [shown, showMove] = useOptimistic(chart, movedInChart);
  const [, startMove] = useTransition();
  const [moveRefusal, setMoveRefusal] = useState<DomainErrorCode>();

  const open: Open = (next, opener) => {
    setTarget(next);
    dialog.show(opener);
  };

  const openDelete: OpenDelete = (next, opener) => {
    setDeleteTarget(next);
    deleteDialog.show(opener);
  };

  const move = (input: MoveChartNodeInput): void => {
    setMoveRefusal(undefined);
    startMove(async () => {
      showMove(input);
      const change = await actions.moveChartNode(input).then(
        (moved) => moved,
        () => UNMOVED,
      );
      if (change.outcome === 'rejected') {
        setMoveRefusal(change.code);
      }
    });
  };

  const rows: Rows = { today, showEnded, open, openDelete };

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
      {moveRefusal === undefined ? null : (
        <p role="alert" className={DANGER_TEXT}>
          {en.accountsSection.moveRefusals[moveRefusal]}
        </p>
      )}
      <ChartDrag chart={shown} onMove={move}>
        <div className={`flex flex-col gap-4 ${typeClasses['body-sm']}`}>
          {accountTypeSchema.options.map((accountType) => (
            <div key={accountType} role="group" aria-labelledby={`${bandId}-${accountType}`}>
              <TypeBand accountType={accountType} id={`${bandId}-${accountType}`} open={open} />
              <TypeList accountType={accountType} chart={shown} rows={rows} />
            </div>
          ))}
        </div>
      </ChartDrag>
      <AccountDialog
        dialog={dialog}
        target={target}
        groups={groupsIn(shown)}
        today={today}
        actions={actions}
      />
      <DeleteAccountDialog dialog={deleteDialog} target={deleteTarget} actions={actions} />
    </section>
  );
}
