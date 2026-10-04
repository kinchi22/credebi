'use client';

import { type EntryFormMode, type PostedEntry } from '@repo/contracts';
import { PencilIcon } from '@repo/ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { en } from '../messages/en';
import { ROW_ICON_BUTTON } from './control-classes';
import { DiscardChanges } from './discard-changes';
import { type EntryFormProps, type EntryFormState } from './entry-form';
import { hasOneLinePerSide } from './entry-lines';
import { useModalDialog } from './modal-dialog';
import { MultiLineEntryForm } from './multi-line-entry-form';
import { SheetBar, SheetCloseButton } from './sheet';
import { TwoLineEntryForm } from './two-line-entry-form';

export type EditEntryAction = (
  id: string,
  previous: EntryFormState,
  form: FormData,
) => Promise<EntryFormState>;

export type EditEntryProps = {
  readonly entry: PostedEntry;
  readonly entryFormMode: EntryFormMode;
  readonly action: EditEntryAction;
};

const FORM_BY_MODE: Readonly<Record<EntryFormMode, (props: EntryFormProps) => ReactNode>> = {
  'two-line': TwoLineEntryForm,
  'multi-line': MultiLineEntryForm,
};

const modeFor = (entry: PostedEntry, chosen: EntryFormMode): EntryFormMode =>
  chosen === 'two-line' && hasOneLinePerSide(entry) ? 'two-line' : 'multi-line';

const fieldsIn = (body: HTMLElement | null): string => {
  const form = body?.querySelector('form');
  return form ? JSON.stringify([...new FormData(form)]) : '';
};

export function EditEntry({ entry, entryFormMode, action }: EditEntryProps): ReactNode {
  const titleId = useId();
  const dialog = useModalDialog({ closesWhenWide: false });
  const discard = useModalDialog({ closesWhenWide: false });
  const body = useRef<HTMLDivElement>(null);
  const opened = useRef('');
  const EntryForm = FORM_BY_MODE[modeFor(entry, entryFormMode)];

  useEffect(() => {
    if (dialog.open) {
      opened.current = fieldsIn(body.current);
    }
  }, [dialog.open]);

  const requestClose = (): void => {
    if (fieldsIn(body.current) === opened.current) {
      dialog.close();
      return;
    }
    const focused = document.activeElement;
    discard.show(focused instanceof HTMLElement ? focused : null);
  };

  const discardChanges = (): void => {
    discard.close();
    dialog.close();
  };

  return (
    <>
      <button
        type="button"
        aria-label={en.editEntry.open}
        onClick={(event) => {
          dialog.show(event.currentTarget);
        }}
        className={ROW_ICON_BUTTON}
      >
        <PencilIcon />
      </button>
      <dialog
        {...dialog.dialogProps}
        onCancel={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            requestClose();
          }
        }}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            requestClose();
          }
        }}
        className="m-0 h-full max-h-none w-full max-w-none border-0 bg-ground p-0 text-text backdrop:bg-ground-dark/60 wide:my-auto wide:mr-14 wide:ml-[17.5rem] wide:h-auto wide:max-h-[calc(100dvh-4rem)] wide:w-auto wide:rounded wide:border wide:border-border wide:bg-surface"
      >
        {dialog.open ? (
          <div className="flex h-full flex-col wide:h-auto wide:max-h-[calc(100dvh-4rem)]">
            <SheetBar titleId={titleId} title={en.editEntry.title}>
              <SheetCloseButton label={en.editEntry.close} onClose={requestClose} />
            </SheetBar>
            <div ref={body} className="min-h-0 grow overflow-y-auto p-4 wide:p-6">
              <EntryForm
                action={action.bind(null, entry.id)}
                editing={{ entry, titleId, onSaved: dialog.close }}
              />
            </div>
          </div>
        ) : null}
      </dialog>
      <DiscardChanges dialog={discard} onDiscard={discardChanges} />
    </>
  );
}
