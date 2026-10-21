'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { duringComposition } from './composition';
import { CONTROL } from './control-classes';

export type ComboboxProps<Option> = {
  readonly id: string;
  readonly labelId: string;
  readonly name?: string;
  readonly value: string;
  readonly offered: readonly Option[];
  readonly keyOf: (option: Option) => string;
  readonly renderOption: (option: Option) => ReactNode;
  readonly nameOption?: (option: Option) => string;
  readonly onType: (text: string) => void;
  readonly onChoose: (option: Option) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly empty?: ReactNode;
  readonly onOpenByClick?: (input: HTMLInputElement) => void;
  readonly onEscapeClosed?: () => void;
};

const LIST =
  'absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-control border border-border bg-surface py-1';
const EMPTY = 'px-2 py-1.5 text-text-muted';
const OPTION =
  'px-2 py-1.5 wrap-anywhere text-text hover:bg-surface-hover aria-selected:bg-surface-hover';

const step = (count: number, at: number, by: 1 | -1): number => {
  const next = at === -1 ? (by === 1 ? 0 : count - 1) : at + by;
  return (next + count) % count;
};

export function Combobox<Option>({
  id,
  labelId,
  name,
  value,
  offered,
  keyOf,
  renderOption,
  nameOption,
  onType,
  onChoose,
  placeholder,
  className = '',
  empty,
  onOpenByClick,
  onEscapeClosed,
}: ComboboxProps<Option>): ReactNode {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>();
  const composing = useRef(false);
  const list = useRef<HTMLUListElement>(null);

  const listId = `${id}-options`;
  const shown = open && (offered.length > 0 || empty !== undefined);
  const activeAt = shown && active !== undefined ? offered.findIndex((option) => keyOf(option) === active) : -1;
  const activeOption = activeAt === -1 ? undefined : offered[activeAt];
  const optionId = (index: number): string => `${listId}-${String(index)}`;

  const close = (): void => {
    setOpen(false);
    setActive(undefined);
  };

  const choose = (option: Option): void => {
    close();
    onChoose(option);
  };

  const moveTo = (index: number): void => {
    setOpen(true);
    const option = offered[index];
    setActive(option === undefined ? undefined : keyOf(option));
    if (option !== undefined) {
      list.current
        ?.querySelector(`#${CSS.escape(optionId(index))}`)
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
        moveTo(shown ? step(offered.length, activeAt, 1) : 0);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(shown ? step(offered.length, activeAt, -1) : offered.length - 1);
        return;
      case 'Enter':
        if (activeOption !== undefined) {
          event.preventDefault();
          choose(activeOption);
        }
        return;
      case 'Escape':
        if (shown) {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else {
          onEscapeClosed?.();
        }
        return;
      default:
        return;
    }
  };

  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={activeAt === -1 ? undefined : optionId(activeAt)}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onType(event.target.value);
          setOpen(true);
          if (!composing.current) {
            setActive(undefined);
          }
        }}
        onClick={(event) => {
          if (!open) {
            onOpenByClick?.(event.currentTarget);
          }
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
        className={`${CONTROL} ${className}`}
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
        {offered.map((option, index) => (
          <li
            key={keyOf(option)}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeAt}
            aria-label={nameOption?.(option)}
            onClick={() => {
              choose(option);
            }}
            className={OPTION}
          >
            {renderOption(option)}
          </li>
        ))}
        {offered.length === 0 && empty !== undefined ? (
          <li role="presentation" className={EMPTY}>
            {empty}
          </li>
        ) : null}
      </ul>
    </>
  );
}
