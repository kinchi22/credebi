'use client';

import { useTranslations } from 'next-intl';
import { monthAfter } from '@repo/core/entries';
import { CalendarIcon } from '@repo/ui';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { DATE_CONTROL, ICON_CONTROL } from './control-classes';
import { MonthGrid } from './month-grid';
import { monthText, monthTyped } from './month-text';
import { PickerPanel, usePickerSurface } from './picker-surface';

export type MonthInputProps = {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  readonly onText: (text: string) => void;
  readonly today: string | undefined;
};

export function MonthInput({ id, name, text, onText, today }: MonthInputProps): ReactNode {
  const t = useTranslations('monthInput');
  const surface = usePickerSurface();
  const { bindRoot, bindTrigger, rootProps } = surface;
  const field = useRef<HTMLInputElement>(null);
  const chosen = monthTyped(text);
  const thisMonth = today === undefined ? undefined : monthAfter(today, 0);
  const invalid = t('invalid');

  useLayoutEffect(() => {
    field.current?.setCustomValidity(text === '' || chosen !== undefined ? '' : invalid);
  }, [text, chosen, invalid]);

  const pick = (month: string): void => {
    onText(monthText(month));
    surface.finish();
  };

  return (
    <div ref={bindRoot} {...rootProps} className="relative flex min-w-0 gap-1.5">
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
        ref={bindTrigger}
        type="button"
        aria-label={t('chooseMonth')}
        aria-expanded={surface.expanded}
        aria-controls={surface.controls}
        disabled={today === undefined && chosen === undefined}
        onClick={(event) => {
          surface.open(event.currentTarget, chosen ?? thisMonth);
        }}
        className={`${ICON_CONTROL} shrink-0`}
      >
        <CalendarIcon />
      </button>
      <PickerPanel surface={surface} label={t('chooseMonth')} closeLabel={t('close')} className="w-64">
        {(start) => <MonthGrid start={start} chosen={chosen} today={thisMonth} onPick={pick} />}
      </PickerPanel>
    </div>
  );
}
