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
};

const LANGUAGES = languageSchema.options;

export function LanguageSwitch({ action }: LanguageSwitchProps): ReactNode {
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
        className={`h-control gap-1.5 px-2 ${typeClasses['body-sm']} ${BARE_ICON_BUTTON}`}
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
          className="absolute bottom-full z-10 mb-1 flex min-w-40 flex-col rounded-control border border-border bg-surface py-1"
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
