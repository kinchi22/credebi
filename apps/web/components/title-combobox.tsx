'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { duringComposition } from './composition';
import { CONTROL, DENSE_FIELD, FIELD_LABEL } from './control-classes';
import { matchesTyped } from './typed-text';

export type TitleComboboxProps = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string | undefined;
  readonly titles: readonly string[];
  readonly className?: string;
};

const LIST =
  'absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-control border border-border bg-surface py-1';
const OPTION =
  'break-words px-2 py-1.5 text-text hover:bg-surface-hover aria-selected:bg-surface-hover';

const step = (
  offered: readonly string[],
  active: string | undefined,
  by: 1 | -1,
): string | undefined => {
  const at = active === undefined ? -1 : offered.indexOf(active);
  const next = at === -1 ? (by === 1 ? 0 : offered.length - 1) : at + by;
  return offered[(next + offered.length) % offered.length];
};

export function TitleCombobox({
  id,
  name,
  label,
  defaultValue,
  titles,
  className = '',
}: TitleComboboxProps): ReactNode {
  const [value, setValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>();
  const composing = useRef(false);
  const list = useRef<HTMLUListElement>(null);

  const listId = `${id}-titles`;
  const labelId = `${id}-label`;
  const offered = titles.filter((title) => matchesTyped(title, value));
  const shown = open && offered.length > 0;
  const activeShown = shown && active !== undefined && offered.includes(active) ? active : undefined;
  const optionId = (index: number): string => `${listId}-${String(index)}`;

  const close = (): void => {
    setOpen(false);
    setActive(undefined);
  };

  const choose = (title: string): void => {
    setValue(title);
    close();
  };

  const moveTo = (title: string | undefined): void => {
    setOpen(true);
    setActive(title);
    if (title !== undefined) {
      list.current
        ?.querySelector(`#${CSS.escape(optionId(offered.indexOf(title)))}`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const composition = duringComposition(event.nativeEvent, composing.current);
    if (composition === 'hold') {
      event.preventDefault();
      event.stopPropagation();
    }
    if (composition !== 'none') {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveTo(shown ? step(offered, activeShown, 1) : offered[0]);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(shown ? step(offered, activeShown, -1) : offered.at(-1));
        return;
      case 'Enter':
        if (activeShown !== undefined) {
          event.preventDefault();
          choose(activeShown);
        }
        return;
      case 'Escape':
        if (shown) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
      default:
        return;
    }
  };

  return (
    <div className={`${DENSE_FIELD} relative ${className}`}>
      <label id={labelId} htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={
          activeShown === undefined ? undefined : optionId(offered.indexOf(activeShown))
        }
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          if (!composing.current) {
            setActive(undefined);
          }
        }}
        onClick={() => {
          setOpen(true);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        className={CONTROL}
      />
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        hidden={!shown}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        className={LIST}
      >
        {offered.map((title, index) => (
          <li
            key={title}
            id={optionId(index)}
            role="option"
            aria-selected={title === activeShown}
            onClick={() => {
              choose(title);
            }}
            className={OPTION}
          >
            {title}
          </li>
        ))}
      </ul>
    </div>
  );
}
