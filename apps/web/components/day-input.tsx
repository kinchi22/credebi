'use client';

import { useTranslations } from 'next-intl';
import { typeClasses } from '@repo/ui/type-classes';
import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { DAY_DIGITS, digitsOfIsoDay, editedDigits, isoOfDayDigits } from './day-digits';

export type DayInputProps = {
  readonly id?: string;
  readonly name: string;
  readonly day: string;
  readonly onDay?: (day: string) => void;
  readonly required?: boolean;
  readonly autoComplete?: string;
  readonly className: string;
};

const RULE_AFTER_DIGITS: readonly number[] = [4, 6];
const LETTER_GAP = '0.1em';
const FRAME_AND_PADDING = '1px + 0.5rem';
const PLACEHOLDER = 'YYYYMMDD';

type Typed = {
  readonly digits: string;
  readonly caret: number | undefined;
};

const ruleOffset = (digits: number): string =>
  `calc(${FRAME_AND_PADDING} + ${String(digits)} * (1ch + ${LETTER_GAP}) - ${LETTER_GAP} / 2)`;

export function DayInput({ id, name, day, onDay, required, autoComplete, className }: DayInputProps): ReactNode {
  const t = useTranslations('dayInput');
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState<Typed>({ digits: digitsOfIsoDay(day), caret: undefined });
  const [kept, setKept] = useState(day);
  const [seenDay, setSeenDay] = useState(day);
  const invalid = t('invalid');

  if (day !== seenDay) {
    setSeenDay(day);
    if (day !== kept) {
      setTyped({ digits: digitsOfIsoDay(day), caret: undefined });
      setKept(day);
    }
  }

  useLayoutEffect(() => {
    const input = field.current;
    if (input !== null && typed.caret !== undefined && document.activeElement === input) {
      input.setSelectionRange(typed.caret, typed.caret);
    }
  }, [typed]);

  useLayoutEffect(() => {
    field.current?.setCustomValidity(
      typed.digits === '' || isoOfDayDigits(typed.digits) !== undefined ? '' : invalid,
    );
  }, [typed.digits, invalid]);

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value, selectionStart } = event.target;
    const edit = editedDigits(typed.digits, value, selectionStart ?? value.length, DAY_DIGITS);
    setTyped(edit);
    const iso = isoOfDayDigits(edit.digits);
    if (iso !== undefined) {
      setKept(iso);
      if (iso !== kept) onDay?.(iso);
    } else if (edit.digits === '') {
      setKept('');
    }
  };

  return (
    <div className={`relative flex min-w-0 ${typeClasses.date} max-wide:text-control`} style={{ letterSpacing: LETTER_GAP }}>
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
    </div>
  );
}
