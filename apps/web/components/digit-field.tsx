'use client';

import { CalendarIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { BARE_ICON_BUTTON } from './control-classes';
import { editedDigits } from './day-digits';
import { PickerPanel, usePickerSurface } from './picker-surface';

export type DigitUnit = {
  readonly limit: number;
  readonly rules: readonly number[];
  readonly placeholder: string;
  readonly isoOf: (digits: string) => string | undefined;
  readonly digitsOf: (iso: string) => string;
};

export type DigitFieldProps = {
  readonly unit: DigitUnit;
  readonly id?: string | undefined;
  readonly name: string;
  readonly value: string;
  readonly onValue?: ((value: string) => void) | undefined;
  readonly required?: boolean | undefined;
  readonly autoComplete?: string | undefined;
  readonly withPicker?: boolean | undefined;
  readonly className: string;
  readonly rootClassName?: string | undefined;
  readonly invalid: string;
  readonly buttonLabel: string;
  readonly popoverLabel?: string | undefined;
  readonly closeLabel: string;
  readonly panelClassName: string;
  readonly fallbackStart: string | undefined;
  readonly picker: (start: string, chosen: string | undefined, pick: (iso: string) => void) => ReactNode;
};

const LETTER_GAP = '0.1em';
const FRAME_AND_PADDING = '1px + 0.5rem';
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

export function DigitField({
  unit,
  id,
  name,
  value,
  onValue,
  required,
  autoComplete,
  withPicker = true,
  className,
  rootClassName,
  invalid,
  buttonLabel,
  popoverLabel,
  closeLabel,
  panelClassName,
  fallbackStart,
  picker,
}: DigitFieldProps): ReactNode {
  const field = useRef<HTMLInputElement>(null);
  const surface = usePickerSurface();
  const { bindRoot, bindTrigger, rootProps } = surface;
  const [typed, setTyped] = useState<Typed>({ digits: unit.digitsOf(value), caret: undefined });
  const [kept, setKept] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  const chosen = unit.isoOf(typed.digits);

  if (value !== seenValue) {
    setSeenValue(value);
    setKept(value);
    if (unit.digitsOf(value) !== typed.digits) {
      setTyped({ digits: unit.digitsOf(value), caret: undefined });
    }
  }

  useLayoutEffect(() => {
    const input = field.current;
    if (input !== null && typed.caret !== undefined && document.activeElement === input) {
      input.setSelectionRange(typed.caret, typed.caret);
    }
  }, [typed]);

  useLayoutEffect(() => {
    const complete = unit.isoOf(typed.digits) !== undefined;
    const optionalEmpty = typed.digits === '' && required !== true;
    field.current?.setCustomValidity(complete || optionalEmpty ? '' : invalid);
  }, [typed.digits, invalid, unit, required]);

  const settle = (edit: Typed): void => {
    setTyped(edit);
    const iso = unit.isoOf(edit.digits);
    if (iso !== undefined) {
      setKept(iso);
      if (iso !== kept) onValue?.(iso);
    } else if (edit.digits === '' && required !== true) {
      setKept('');
    }
  };

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value: raw, selectionStart } = event.target;
    settle(editedDigits(typed.digits, raw, selectionStart ?? raw.length, unit.limit, typedOneCharacter(event)));
  };

  const pick = (iso: string): void => {
    settle({ digits: unit.digitsOf(iso), caret: undefined });
    surface.finish();
  };

  return (
    <div ref={bindRoot} {...rootProps} className={`relative flex min-w-0 ${rootClassName ?? ''}`}>
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
          placeholder={unit.placeholder}
          size={unit.limit + 2}
          className={`${className} w-full min-w-0`}
          style={withPicker ? { paddingRight: BUTTON_ROOM } : undefined}
        />
        <input type="hidden" name={name} value={kept} />
        {unit.rules.map((digits) => (
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
            disabled={fallbackStart === undefined && chosen === undefined}
            onClick={(event) => {
              surface.open(event.currentTarget, chosen ?? fallbackStart);
            }}
            className={CALENDAR_BUTTON}
          >
            <CalendarIcon />
            <span className="sr-only">{buttonLabel}</span>
          </button>
        ) : null}
      </div>
      {withPicker ? (
        <PickerPanel
          surface={surface}
          label={buttonLabel}
          popoverLabel={popoverLabel ?? buttonLabel}
          closeLabel={closeLabel}
          className={panelClassName}
        >
          {(start) => picker(start, chosen, pick)}
        </PickerPanel>
      ) : null}
    </div>
  );
}
