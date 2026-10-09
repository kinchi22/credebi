'use client';

import { accountTypeSchema, type AccountOutput, type ChartOutput } from '@repo/contracts';
import { GripIcon, PencilIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, type ReactNode } from 'react';
import { en } from '../messages/en';
import { AccountDialog, type AccountAction, type AccountDialogTarget } from './account-dialog';
import { useBrowserToday } from './browser-today';
import { BARE_ICON_BUTTON, LEGEND, ROW_ICON_BUTTON } from './control-classes';
import { useModalDialog } from './modal-dialog';

export type AccountsSectionProps = {
  readonly chart: ChartOutput;
  readonly addAction: AccountAction;
  readonly editAction: AccountAction;
};

const mayHaveEnded = (account: AccountOutput, today: string | undefined): boolean =>
  account.activeUntil !== null && (today === undefined || account.activeUntil < today);

const startsLater = (account: AccountOutput, today: string | undefined): boolean =>
  today !== undefined && account.activeFrom > today;

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
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${en.accountsSection.move} ${account.name}`}
        className={`${BARE_ICON_BUTTON} shrink-0 cursor-grab`}
      >
        <GripIcon />
      </button>
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
        {account.description === null ? null : (
          <span className={`${typeClasses['body-dense']} text-text-muted`}>
            {account.description}
          </span>
        )}
      </span>
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
    </li>
  );
}

export function AccountsSection({ chart, addAction, editAction }: AccountsSectionProps): ReactNode {
  const titleId = useId();
  const bandId = useId();
  const today = useBrowserToday();
  const dialog = useModalDialog({ closesWhenWide: false });
  const [target, setTarget] = useState<AccountDialogTarget>();
  const [showEnded, setShowEnded] = useState(false);

  const open = (next: AccountDialogTarget, opener: HTMLElement): void => {
    setTarget(next);
    dialog.show(opener);
  };

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
            <div className="flex items-center justify-between bg-band px-2 py-1">
              <span id={`${bandId}-${accountType}`} className={`${typeClasses.label} text-text-muted`}>
                {en.accountTypes[accountType]}
              </span>
              <button
                type="button"
                aria-label={en.accountsSection.addAccount}
                onClick={(event) => {
                  open({ kind: 'add', accountType }, event.currentTarget);
                }}
                className="text-accent-text hover:underline"
              >
                {en.accountsSection.addAccountText}
              </button>
            </div>
            <ul className="px-2">
              {chart
                .filter(
                  (account) =>
                    account.accountType === accountType && (showEnded || !mayHaveEnded(account, today)),
                )
                .map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    today={today}
                    onEdit={(opener) => {
                      open({ kind: 'edit', account }, opener);
                    }}
                  />
                ))}
            </ul>
          </div>
        ))}
      </div>
      <AccountDialog
        dialog={dialog}
        target={target}
        today={today}
        addAction={addAction}
        editAction={editAction}
      />
    </section>
  );
}
