'use client';

import { useTranslations } from 'next-intl';
import {
  ACCOUNT_FORM_FIELDS,
  type AccountGroupOutput,
  type AccountOutput,
  type AccountType,
  type DomainErrorCode,
} from '@repo/contracts';
import { typeClasses } from '@repo/ui/type-classes';
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useId,
  useState,
  useTransition,
  type ReactNode,
  type SubmitEvent,
  type TransitionStartFunction,
} from 'react';
import {
  CONFIRMATION_DIALOG,
  CONFIRMATION_PANEL,
  CONTROL,
  DATE_CONTROL,
  FIELD,
  PRIMARY_BUTTON,
} from './control-classes';
import { useChangeGuard } from './use-change-guard';
import { CloseButton } from './close-button';
import { DiscardChanges } from './discard-changes';
import { type ModalDialog } from './use-modal-dialog';
import { MUTED_TEXT, DANGER_TEXT } from './text-classes';

export type ChartChange =
  | { readonly outcome: 'saved' }
  | { readonly outcome: 'rejected'; readonly code: DomainErrorCode };

export type ChartAction = (accountTypeOrId: string, form: FormData) => Promise<ChartChange>;

export type ChartActions = {
  readonly addAccount: ChartAction;
  readonly editAccount: ChartAction;
  readonly addAccountGroup: ChartAction;
  readonly editAccountGroup: ChartAction;
};

export type AccountDialogTarget =
  | {
      readonly kind: 'account';
      readonly accountType: AccountType;
      readonly editing: AccountOutput | undefined;
    }
  | {
      readonly kind: 'group';
      readonly accountType: AccountType;
      readonly editing: AccountGroupOutput | undefined;
    };

export type AccountDialogProps = {
  readonly dialog: ModalDialog;
  readonly target: AccountDialogTarget | undefined;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
  readonly actions: ChartActions;
};

type AccountDefaults = {
  readonly groupId: string;
  readonly activeFrom: string | undefined;
  readonly activeUntil: string;
};

type Kept = {
  readonly round: number;
  readonly fields: AccountDefaults | undefined;
};

type StatusLine =
  | { readonly shows: 'added'; readonly name: string }
  | { readonly shows: 'refusal'; readonly code: DomainErrorCode }
  | undefined;

const textOf = (form: FormData, field: string): string => {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
};

const accountDefaultsFrom = (form: FormData): AccountDefaults => ({
  groupId: textOf(form, ACCOUNT_FORM_FIELDS.group),
  activeFrom: textOf(form, ACCOUNT_FORM_FIELDS.activeFrom),
  activeUntil: textOf(form, ACCOUNT_FORM_FIELDS.activeUntil),
});

const UNSAVED: ChartChange = { outcome: 'rejected', code: 'DEPENDENCY_UNAVAILABLE' };

const KINDS = {
  account: {
    addTitle: 'accountDialog.addTitle',
    editTitle: 'accountDialog.editTitle',
    refusals: 'accountDialog.refusals',
  },
  group: {
    addTitle: 'accountDialog.addGroupTitle',
    editTitle: 'accountDialog.editGroupTitle',
    refusals: 'accountDialog.groupRefusals',
  },
} as const;

function saverOf(
  target: AccountDialogTarget,
  actions: ChartActions,
): (form: FormData) => Promise<ChartChange> {
  const [add, edit] =
    target.kind === 'account'
      ? [actions.addAccount, actions.editAccount]
      : [actions.addAccountGroup, actions.editAccountGroup];
  return target.editing === undefined
    ? add.bind(null, target.accountType)
    : edit.bind(null, target.editing.id);
}

function AccountFields({
  defaults,
  accountType,
  groups,
}: {
  readonly defaults: AccountDefaults;
  readonly accountType: AccountType;
  readonly groups: readonly AccountGroupOutput[];
}): ReactNode {
  const t = useTranslations();
  const groupId = useId();

  return (
    <>
      <div className={FIELD}>
        <label htmlFor={groupId}>{t('accountDialog.group')}</label>
        <select
          id={groupId}
          name={ACCOUNT_FORM_FIELDS.group}
          defaultValue={defaults.groupId}
          className={`${CONTROL} max-w-full`}
        >
          <option value="">{t('accountDialog.noGroup')}</option>
          {groups
            .filter((group) => group.accountType === accountType)
            .map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className={`${FIELD} min-w-0 flex-1`}>
          {t('accountDialog.activeFrom')}
          <input
            type="date"
            name={ACCOUNT_FORM_FIELDS.activeFrom}
            required
            defaultValue={defaults.activeFrom}
            className={DATE_CONTROL}
          />
        </label>
        <label className={`${FIELD} min-w-0 flex-1`}>
          {t('accountDialog.activeUntil')}
          <input
            type="date"
            name={ACCOUNT_FORM_FIELDS.activeUntil}
            defaultValue={defaults.activeUntil}
            className={DATE_CONTROL}
          />
        </label>
      </div>
    </>
  );
}

function AccountForm({
  target,
  groups,
  today,
  titleId,
  onClose,
  onSaved,
  save,
  pending,
  startTransition,
  retakeSnapshot,
}: {
  readonly target: AccountDialogTarget;
  readonly groups: readonly AccountGroupOutput[];
  readonly today: string | undefined;
  readonly titleId: string;
  readonly onClose: () => void;
  readonly onSaved: () => void;
  readonly save: (form: FormData) => Promise<ChartChange>;
  readonly pending: boolean;
  readonly startTransition: TransitionStartFunction;
  readonly retakeSnapshot: () => void;
}): ReactNode {
  const t = useTranslations();
  const [status, setStatus] = useState<StatusLine>();
  const [addAnother, setAddAnother] = useState(false);
  const [kept, setKept] = useState<Kept>({ round: 0, fields: undefined });
  const descriptionId = useId();
  const kind = KINDS[target.kind];
  const described = target.editing;
  const adding = described === undefined;

  const retakeSnapshotAfterKeptOpen = useEffectEvent(retakeSnapshot);

  useEffect(() => {
    if (kept.round > 0) {
      retakeSnapshotAfterKeptOpen();
    }
  }, [kept.round]);

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const keepingOpen = adding && addAnother;
    startTransition(async () => {
      const change = await save(form).then(
        (saved) => saved,
        () => UNSAVED,
      );
      if (change.outcome === 'rejected') {
        setStatus({ shows: 'refusal', code: change.code });
        return;
      }
      if (!keepingOpen) {
        onSaved();
        return;
      }
      setStatus({ shows: 'added', name: textOf(form, ACCOUNT_FORM_FIELDS.name).trim() });
      setKept((previous) => ({ round: previous.round + 1, fields: accountDefaultsFrom(form) }));
    });
  };

  const account = target.kind === 'account' ? target.editing : undefined;
  const accountDefaults: AccountDefaults = kept.fields ?? {
    groupId: account?.groupId ?? '',
    activeFrom: account?.activeFrom ?? today,
    activeUntil: account?.activeUntil ?? '',
  };

  return (
    <form onSubmit={submit} className={CONFIRMATION_PANEL}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className={typeClasses.h2}>
            {t(adding ? kind.addTitle : kind.editTitle)}
          </h2>
          <p className={MUTED_TEXT}>{t(`accountTypes.${target.accountType}`)}</p>
        </div>
        <CloseButton label={t('accountDialog.close')} onClose={onClose} disabled={pending} />
      </div>
      <Fragment key={kept.round}>
        <label className={FIELD}>
          {t('accountDialog.name')}
          <input
            name={ACCOUNT_FORM_FIELDS.name}
            required
            autoFocus
            defaultValue={described?.name}
            className={CONTROL}
          />
        </label>
        <div className={FIELD}>
          <label htmlFor={descriptionId}>{t('accountDialog.description')}</label>
          <textarea
            id={descriptionId}
            name={ACCOUNT_FORM_FIELDS.description}
            rows={2}
            defaultValue={described?.description ?? ''}
            className={CONTROL}
          />
        </div>
        {target.kind === 'account' ? (
          <AccountFields
            defaults={accountDefaults}
            accountType={target.accountType}
            groups={groups}
          />
        ) : null}
      </Fragment>
      <div className="flex flex-col">
        <div role="status" className={`${MUTED_TEXT} not-empty:mb-4`}>
          {status?.shows === 'refusal' ? (
            <p role="alert" className={DANGER_TEXT}>
              {t(`${kind.refusals}.${status.code}`)}
            </p>
          ) : null}
          {status?.shows === 'added' ? <p>{t('accountDialog.added', { name: status.name })}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {adding ? (
            <label className={`flex items-center gap-2 ${typeClasses['body-sm']}`}>
              <input
                type="checkbox"
                disabled={pending}
                checked={addAnother}
                onChange={(event) => {
                  setAddAnother(event.currentTarget.checked);
                }}
              />
              {t('accountDialog.addAnother')}
            </label>
          ) : null}
          <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} ml-auto`}>
            {pending ? t('accountDialog.pending') : t('accountDialog.save')}
          </button>
        </div>
      </div>
    </form>
  );
}

export function AccountDialog({
  dialog,
  target,
  groups,
  today,
  actions,
}: AccountDialogProps): ReactNode {
  const t = useTranslations();
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const guard = useChangeGuard(dialog, pending);

  return (
    <>
      <dialog
        {...guard.dialogProps}
        aria-labelledby={titleId}
        className={CONFIRMATION_DIALOG}
      >
        {dialog.open && target !== undefined ? (
          <AccountForm
            target={target}
            groups={groups}
            today={today}
            titleId={titleId}
            onClose={guard.requestClose}
            onSaved={dialog.close}
            save={saverOf(target, actions)}
            pending={pending}
            startTransition={startTransition}
            retakeSnapshot={guard.retakeSnapshot}
          />
        ) : null}
      </dialog>
      {target === undefined ? null : (
        <DiscardChanges
          dialog={guard.discard}
          body={t(`discardChanges.${target.kind}`)}
          onDiscard={guard.discardChanges}
        />
      )}
    </>
  );
}
