'use client';

import { useState, type ReactNode } from 'react';
import { Combobox } from './combobox';
import { DENSE_FIELD, FIELD, FIELD_LABEL } from './control-classes';
import { matchesTyped } from './typed-text';

export type TitleComboboxProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string | undefined;
  readonly titles: readonly string[];
  readonly dense?: boolean;
  readonly className?: string;
  readonly onChoose?: (title: string) => void;
  readonly onType?: ((title: string) => void) | undefined;
};

const itself = (title: string): string => title;

export function TitleCombobox({
  id,
  name,
  label,
  defaultValue,
  titles,
  dense = true,
  className = '',
  onChoose,
  onType,
}: TitleComboboxProps): ReactNode {
  const [value, setValue] = useState(defaultValue ?? '');
  const labelId = `${id}-label`;

  return (
    <div className={`${dense ? DENSE_FIELD : FIELD} relative ${className}`}>
      <label id={labelId} htmlFor={id} className={dense ? FIELD_LABEL : undefined}>
        {label}
      </label>
      <Combobox
        id={id}
        labelId={labelId}
        name={name}
        value={value}
        offered={titles.filter((title) => matchesTyped(title, value))}
        keyOf={itself}
        renderOption={itself}
        onType={(text) => {
          setValue(text);
          onType?.(text);
        }}
        onChoose={(title) => {
          setValue(title);
          onChoose?.(title);
        }}
      />
    </div>
  );
}
