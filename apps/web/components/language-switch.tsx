'use client';

import { languageSchema, type Language } from '@repo/contracts';
import { CheckIcon, GlobeIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useLocale, useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { BARE_ICON_BUTTON } from './control-classes';
import { useDismissOutside } from './use-dismiss-outside';
import { DOWN_STEPS } from './roving-focus';

export type LanguageSwitchProps = {
  readonly action: (language: Language) => Promise<void>;
  readonly onDark?: boolean;
  readonly opensDown?: boolean;
};

const ON_DARK_SWITCH = 'inline-flex items-center justify-center rounded-control text-text-muted-on-dark hover:bg-ground-dark-hover hover:text-text-on-dark focus-visible:outline-focus-on-dark';

const LANGUAGES = languageSchema.options;

export function LanguageSwitch({ action, onDark = false, opensDown = false }: LanguageSwitchProps): ReactNode {
  const t = useTranslations('language');
  const current = useLocale();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const dismiss = useCallback((): void => {
    setOpen(false);
  }, []);
  useDismissOutside(open, root, dismiss);

  useEffect(() => {
    if (open) {
      choices.current[LANGUAGES.indexOf(current)]?.focus();
    }
  }, [open, current]);

  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };

  const choose = (language: Language): void => {
    close();
    if (language !== current) {
      startTransition(async () => {
        await action(language);
      });
    }
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const step = DOWN_STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const focused = choices.current.findIndex((choice) => choice === document.activeElement);
    choices.current[step(focused === -1 ? LANGUAGES.indexOf(current) : focused, LANGUAGES.length)]?.focus();
  };

  return (
    <div ref={root} className="relative flex justify-center">
      <button
        ref={button}
        type="button"
        aria-haspopup
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((shown) => !shown);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`h-control gap-1.5 px-2 ${typeClasses['body-sm']} ${onDark ? ON_DARK_SWITCH : BARE_ICON_BUTTON}`}
      >
        <GlobeIcon />
        {t('label')}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t('label')}
          onKeyDown={moveFocus}
          className={`absolute ${opensDown ? 'top-full right-0 mt-1' : 'bottom-full mb-1'} z-10 flex min-w-40 flex-col rounded-control border border-border bg-surface py-1`}
        >
          {LANGUAGES.map((language, index) => {
            const chosen = language === current;
            return (
              <button
                key={language}
                ref={(choice) => {
                  choices.current[index] = choice;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={chosen}
                tabIndex={-1}
                lang={language}
                onClick={() => {
                  choose(language);
                }}
                className={`flex h-control items-center gap-2 px-3 text-left ${typeClasses['body-sm']} text-text hover:bg-surface-hover focus-visible:bg-surface-hover ${chosen ? 'font-semibold' : ''}`}
              >
                <span className="inline-flex size-4 text-accent-text">{chosen ? <CheckIcon /> : null}</span>
                {t(`names.${language}`)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
