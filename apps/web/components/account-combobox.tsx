'use client';

import { useTranslations } from 'next-intl';
import { type AccountOutput } from '@repo/contracts';
import { CloseIcon } from '@repo/ui';
import { useRef, useState, type ReactNode } from 'react';
import { nameContains } from './chart-tree';
import { Combobox } from './combobox';
import { BARE_ICON_BUTTON, FIELD } from './control-classes';
import { TypeIcon } from './type-band';

export type AccountComboboxProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly accounts: readonly AccountOutput[];
  readonly defaultValue: string | undefined;
};

const keyOf = (account: AccountOutput): string => account.id;

export function AccountCombobox({ id, name, label, accounts, defaultValue }: AccountComboboxProps): ReactNode {
  const t = useTranslations('entrySearch');
  const tTypes = useTranslations('accountTypes');
  const [chosen, setChosen] = useState(() => accounts.find((account) => account.id === defaultValue));
  const [text, setText] = useState(chosen?.name ?? '');
  const input = useRef<HTMLInputElement>(null);
  const labelId = `${id}-label`;
  const showsChosen = chosen !== undefined && text === chosen.name;

  const choose = (account: AccountOutput | undefined): void => {
    setChosen(account);
    setText(account?.name ?? '');
  };

  return (
    <div className={`${FIELD} max-w-full min-w-0`}>
      <label id={labelId} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        {showsChosen ? (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-text">
            <TypeIcon accountType={chosen.accountType} />
          </span>
        ) : null}
        <Combobox
          id={id}
          labelId={labelId}
          value={text}
          offered={accounts.filter(nameContains(text))}
          keyOf={keyOf}
          optionLabel={(account) =>
            t('accountOption', { name: account.name, type: tTypes(account.accountType) })
          }
          renderOption={(account) => (
            <span className="flex items-start gap-2">
              <span className="flex h-lh shrink-0 items-center">
                <TypeIcon accountType={account.accountType} />
              </span>
              <span className="min-w-0">{account.name}</span>
            </span>
          )}
          placeholder={t('anyAccount')}
          emptyMessage={t('noAccountMatches')}
          className={`w-full ${showsChosen ? 'pl-8' : ''} ${chosen === undefined ? '' : 'pr-9'}`}
          onType={setText}
          onChoose={choose}
          inputRef={input}
          onOpen={(field) => {
            if (showsChosen) {
              field.select();
            }
          }}
          onEscapeClosed={() => {
            choose(chosen);
          }}
        />
        {chosen === undefined ? null : (
          <button
            type="button"
            aria-label={t('clearAccount')}
            onClick={() => {
              choose(undefined);
              input.current?.focus();
            }}
            className={`absolute inset-y-0 right-0 w-9 ${BARE_ICON_BUTTON}`}
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <input type="hidden" name={name} value={chosen?.id ?? ''} />
    </div>
  );
}
