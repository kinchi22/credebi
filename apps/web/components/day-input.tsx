'use client';

import { useTranslations } from 'next-intl';
import { CalendarIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { BARE_ICON_BUTTON } from './control-classes';
import { DAY_DIGITS, digitsOfIsoDay, editedDigits, isoOfDayDigits } from './day-digits';
import { DayPicker } from './day-picker';
import { PickerPanel, usePickerSurface } from './picker-surface';
import { useBrowserToday } from './use-browser-today';

export type DayInputProps = {
  readonly id?: string;
  readonly name: string;
  readonly day: string;
  readonly onDay?: (day: string) => void;
  readonly required?: boolean;
  readonly autoComplete?: string;
  readonly withPicker?: boolean;
  readonly className: string;
};

const RULE_AFTER_DIGITS: readonly number[] = [4, 6];
const LETTER_GAP = '0.1em';
const FRAME_AND_PADDING = '1px + 0.5rem';
const PLACEHOLDER = 'YYYYMMDD';
const BUTTON_ROOM = '2.25rem';
const CALENDAR_BUTTON = `absolute inset-y-0.5 right-0.5 w-8 ${BARE_ICON_BUTTON} disabled:opacity-50`;

type Typed = {
  readonly digits: string;
  readonly caret: number | undefined;
};

const ruleOffset = (digits: number): string =>
  `calc(${FRAME_AND_PADDING} + ${String(digits)} * (1ch + ${LETTER_GAP}) - ${LETTER_GAP} / 2)`;

function typedOneCharacter(event: ChangeEvent<HTMLInputElement>): boolean {
  const native = event.nativeEvent;
  return native instanceof InputEvent && native.inputType === 'insertText' && native.data?.length === 1;
}

export function DayInput({
  id,
  name,
  day,
  onDay,
  required,
  autoComplete,
  withPicker = true,
  className,
}: DayInputProps): ReactNode {
  const t = useTranslations('dayInput');
  const field = useRef<HTMLInputElement>(null);
  const surface = usePickerSurface();
  const { bindRoot, bindTrigger, rootProps } = surface;
  const today = useBrowserToday();
  const [typed, setTyped] = useState<Typed>({
    digits: digitsOfIsoDay(day),
    caret: undefined,
  });
  const [kept, setKept] = useState(day);
  const [seenDay, setSeenDay] = useState(day);
  const invalid = t('invalid');
  const chosen = isoOfDayDigits(typed.digits);

  if (day !== seenDay) {
    setSeenDay(day);
    setKept(day);
    if (digitsOfIsoDay(day) !== typed.digits) {
      setTyped({ digits: digitsOfIsoDay(day), caret: undefined });
    }
  }

  useLayoutEffect(() => {
    const input = field.current;
    if (input !== null && typed.caret !== undefined && document.activeElement === input) {
      input.setSelectionRange(typed.caret, typed.caret);
    }
  }, [typed]);

  useLayoutEffect(() => {
    field.current?.setCustomValidity(typed.digits === '' || isoOfDayDigits(typed.digits) !== undefined ? '' : invalid);
  }, [typed.digits, invalid]);

  const settle = (edit: Typed): void => {
    setTyped(edit);
    const iso = isoOfDayDigits(edit.digits);
    if (iso !== undefined) {
      setKept(iso);
      if (iso !== kept) onDay?.(iso);
    } else if (edit.digits === '' && required !== true) {
      setKept('');
    }
  };

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value, selectionStart } = event.target;
    settle(editedDigits(typed.digits, value, selectionStart ?? value.length, DAY_DIGITS, typedOneCharacter(event)));
  };

  const pick = (iso: string): void => {
    settle({ digits: digitsOfIsoDay(iso), caret: undefined });
    surface.finish();
  };

  return (
    <div ref={bindRoot} {...rootProps} className="relative flex min-w-0">
      <div
        className={`relative flex min-w-0 flex-1 ${typeClasses.date} max-wide:text-control`}
        style={{ letterSpacing: LETTER_GAP }}
      >
        <input
          ref={field}
          id={id}
          type="text"
          inputMode="numeric"
          value={typed.digits}
          onChange={change}
          required={required}
          autoComplete={autoComplete ?? 'off'}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          size={DAY_DIGITS + 2}
          className={`${className} min-w-0`}
          style={withPicker ? { paddingRight: BUTTON_ROOM } : undefined}
        />
        <input type="hidden" name={name} value={kept} />
        {RULE_AFTER_DIGITS.map((digits) => (
          <span
            key={digits}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2 w-px bg-border"
            style={{ left: ruleOffset(digits) }}
          />
        ))}
        {withPicker ? (
          <button
            ref={bindTrigger}
            type="button"
            aria-expanded={surface.expanded}
            aria-controls={surface.controls}
            disabled={today === undefined && chosen === undefined}
            onClick={(event) => {
              surface.open(event.currentTarget, chosen ?? today);
            }}
            className={CALENDAR_BUTTON}
          >
            <CalendarIcon />
            <span className="sr-only">{t('chooseDate')}</span>
          </button>
        ) : null}
      </div>
      {withPicker ? (
        <PickerPanel
          surface={surface}
          label={t('chooseDate')}
          popoverLabel={t('calendar')}
          closeLabel={t('close')}
          className="w-72"
        >
          {(start) => <DayPicker start={start} chosen={chosen} today={today} onPick={pick} />}
        </PickerPanel>
      ) : null}
    </div>
  );
}
