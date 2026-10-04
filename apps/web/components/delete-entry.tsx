'use client';

import { type DomainErrorCode, type PostedEntry } from '@repo/contracts';
import { TrashIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { en } from '../messages/en';
import { formatAmount } from './amount';
import { BARE_ICON_BUTTON, BUTTON, DANGER_BUTTON } from './control-classes';
import { useModalDialog } from './modal-dialog';
import { DANGER_TEXT } from './text-classes';

export type EntryDeletion =
  | { readonly outcome: 'deleted' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type DeleteEntryAction = (id: string) => Promise<EntryDeletion>;

export type DeleteEntryProps = {
  readonly entry: PostedEntry;
  readonly action: DeleteEntryAction;
};

const ROW_ICON_BUTTON = `-my-1.5 size-8 shrink-0 wide:-my-0.5 wide:size-6 ${BARE_ICON_BUTTON}`;

export function DeleteEntry({ entry, action }: DeleteEntryProps): ReactNode {
  const titleId = useId();
  const dialog = useModalDialog({ closesWhenWide: false });
  const [refusal, setRefusal] = useState<DomainErrorCode>();
  const [pending, startTransition] = useTransition();

  const cancel = (): void => {
    if (!pending) {
      dialog.close();
    }
  };

  const confirm = (): void => {
    startTransition(async () => {
      const deletion = await action(entry.id);
      if (deletion.outcome === 'deleted') {
        dialog.close();
        return;
      }
      setRefusal(deletion.code);
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label={en.deleteEntry.open}
        onClick={(event) => {
          setRefusal(undefined);
          dialog.show(event.currentTarget);
        }}
        className={ROW_ICON_BUTTON}
      >
        <TrashIcon />
      </button>
      <dialog
        {...dialog.dialogProps}
        onCancel={(event) => {
          if (pending) {
            event.preventDefault();
          }
        }}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (!pending) {
            dialog.closeOnScrim(event);
          }
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-100 rounded border border-border bg-surface p-0 text-text backdrop:bg-ground-dark/60"
      >
        {dialog.open ? (
          <div className="flex flex-col gap-4 p-4 wide:p-6">
            <h2 id={titleId} className={typeClasses.h2}>
              {en.deleteEntry.title}
            </h2>
            <p className={`flex items-baseline gap-x-3 border-y border-border py-2 ${typeClasses['body-sm']}`}>
              <time dateTime={entry.entryDate} className={`${typeClasses.date} shrink-0 text-text-muted`}>
                {entry.entryDate}
              </time>{' '}
              <span className="min-w-0 grow font-semibold">{entry.memo}</span>{' '}
              <span className={`shrink-0 ${typeClasses.figure} font-medium`}>
                {formatAmount(entry.total)}
              </span>
            </p>
            {refusal === undefined ? null : (
              <p role="alert" className={DANGER_TEXT}>
                {en.deleteEntry.refusals[refusal]}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" autoFocus onClick={cancel} disabled={pending} className={BUTTON}>
                {en.deleteEntry.cancel}
              </button>
              <button type="button" onClick={confirm} disabled={pending} className={DANGER_BUTTON}>
                {pending ? en.deleteEntry.pending : en.deleteEntry.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
