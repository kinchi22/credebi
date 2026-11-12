'use client';

import { useTranslations } from 'next-intl';
import { CalendarIcon, ChevronIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { CloseButton } from './close-button';
import { BARE_ICON_BUTTON, DATE_CONTROL, ICON_CONTROL } from './control-classes';
import { GRID_STEPS, monthAfter, monthText, monthTyped } from './month-text';
import { SheetBar } from './sheet';
import { useDismissOutside } from './use-dismiss-outside';
import { useModalDialog } from './use-modal-dialog';
import { useMonthLabel } from './use-month-label';
import { useWide } from './use-wide';

export type MonthInputProps = {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  readonly onText: (text: string) => void;
  readonly today: string | undefined;
};

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

const MONTH = `rounded-control px-2 py-2 ${typeClasses['body-dense']} hover:bg-ground`;
const TODAY_MONTH = 'font-semibold text-accent-text underline decoration-accent decoration-2 underline-offset-4';
const CHOSEN_MONTH = 'bg-surface-chosen hover:bg-surface-chosen';
const YEAR_BUTTON = `size-8 ${BARE_ICON_BUTTON}`;

const monthOfYear = (year: string, number: number): string => `${year}-${String(number).padStart(2, '0')}`;

const monthClass = (today: boolean, chosen: boolean): string =>
  [MONTH, today ? TODAY_MONTH : 'text-text', chosen ? CHOSEN_MONTH : ''].join(' ');

type MonthGridProps = {
  readonly start: string;
  readonly chosen: string | undefined;
  readonly today: string | undefined;
  readonly onPick: (month: string) => void;
};

function MonthGrid({ start, chosen, today, onPick }: MonthGridProps): ReactNode {
  const t = useTranslations('monthInput');
  const presets = useTranslations('datePresets');
  const monthLabel = useMonthLabel();
  const [active, setActive] = useState(start);
  const buttons = useRef<Partial<Record<number, HTMLButtonElement | null>>>({});
  const year = active.slice(0, 4);
  const activeNumber = Number(active.slice(5, 7));

  useEffect(() => {
    buttons.current[Number(start.slice(5, 7))]?.focus();
  }, [start]);

  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = GRID_STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const next = monthAfter(active, step);
    flushSync(() => {
      setActive(next);
    });
    buttons.current[Number(next.slice(5, 7))]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t('previousYear')}
          onClick={() => {
            setActive(monthAfter(active, -12));
          }}
          className={YEAR_BUTTON}
        >
          <span className="inline-flex rotate-180">
            <ChevronIcon />
          </span>
        </button>
        <span className={`${typeClasses.date} font-semibold text-text`}>{year}</span>
        <button
          type="button"
          aria-label={t('nextYear')}
          onClick={() => {
            setActive(monthAfter(active, 12));
          }}
          className={YEAR_BUTTON}
        >
          <ChevronIcon />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1" onKeyDown={move}>
        {MONTH_NUMBERS.map((number) => {
          const month = monthOfYear(year, number);
          const isToday = month === today;
          return (
            <button
              key={number}
              ref={(element) => {
                buttons.current[number] = element;
              }}
              type="button"
              aria-label={monthLabel(month)}
              aria-current={isToday ? 'date' : undefined}
              tabIndex={number === activeNumber ? 0 : -1}
              onClick={() => {
                onPick(month);
              }}
              className={monthClass(isToday, month === chosen)}
            >
              {presets('month', { month: number })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthInput({ id, name, text, onText, today }: MonthInputProps): ReactNode {
  const t = useTranslations('monthInput');
  const wide = useWide();
  const sheet = useModalDialog();
  const field = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<string>();
  const [sheetStart, setSheetStart] = useState<string>();
  const gridId = useId();
  const titleId = `${gridId}-title`;
  const chosen = monthTyped(text);
  const thisMonth = today?.slice(0, 7);
  const invalid = t('invalid');

  useLayoutEffect(() => {
    field.current?.setCustomValidity(text === '' || chosen !== undefined ? '' : invalid);
  }, [text, chosen, invalid]);

  const closePopover = useCallback((): void => {
    setPopover(undefined);
  }, []);

  useDismissOutside(popover !== undefined, root, closePopover);

  const open = (opener: HTMLButtonElement): void => {
    const start = chosen ?? thisMonth;
    if (popover !== undefined || start === undefined) {
      setPopover(undefined);
      return;
    }
    if (wide) {
      setPopover(start);
    } else if (sheet.show(opener)) {
      setSheetStart(start);
    }
  };

  const pick = (month: string): void => {
    onText(monthText(month));
    if (popover === undefined) {
      sheet.close();
    } else {
      setPopover(undefined);
      trigger.current?.focus();
    }
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && popover !== undefined) {
      event.preventDefault();
      setPopover(undefined);
      trigger.current?.focus();
    }
  };

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) {
      setPopover(undefined);
    }
  };

  return (
    <div ref={root} className="relative flex min-w-0 gap-1.5" onBlur={closeWhenFocusLeaves} onKeyDown={closeOnEscape}>
      <input
        ref={field}
        id={id}
        type="text"
        value={text}
        onChange={(event) => {
          onText(event.target.value);
        }}
        onBlur={() => {
          if (chosen !== undefined) onText(monthText(chosen));
        }}
        required
        autoComplete="off"
        spellCheck={false}
        className={`${DATE_CONTROL} w-full min-w-0 wide:w-28`}
      />
      <input type="hidden" name={name} value={chosen ?? ''} />
      <button
        ref={trigger}
        type="button"
        aria-label={t('chooseMonth')}
        aria-expanded={popover !== undefined || sheet.open}
        aria-controls={gridId}
        disabled={today === undefined && chosen === undefined}
        onClick={(event) => {
          open(event.currentTarget);
        }}
        className={`${ICON_CONTROL} shrink-0`}
      >
        <CalendarIcon />
      </button>
      {popover === undefined ? null : (
        <div className="absolute top-full left-0 z-10 pt-1.5">
          <div
            id={gridId}
            role="dialog"
            aria-label={t('chooseMonth')}
            className="w-64 rounded-control border border-border bg-surface p-2"
          >
            <MonthGrid start={popover} chosen={chosen} today={thisMonth} onPick={pick} />
          </div>
        </div>
      )}
      <dialog
        {...sheet.dialogProps}
        id={popover === undefined ? gridId : undefined}
        aria-labelledby={titleId}
        onClick={sheet.closeOnScrim}
        className="mx-0 mt-auto mb-0 max-h-none w-full max-w-none overflow-hidden rounded-t-panel border-0 bg-ground p-0 text-text backdrop:bg-ground-dark/60"
      >
        {sheet.open && sheetStart !== undefined ? (
          <>
            <SheetBar titleId={titleId} title={t('chooseMonth')}>
              <CloseButton label={t('close')} onClose={sheet.close} />
            </SheetBar>
            <div className="px-4 pt-3 pb-5">
              <MonthGrid start={sheetStart} chosen={chosen} today={thisMonth} onPick={pick} />
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
