'use client';

import {
  RELATIVE_DIRECTIONS,
  currentPeriod,
  monthPresets,
  quarterPresets,
  relativePresets,
  yearPresets,
  type DayRange,
  type RelativePreset,
} from '@repo/core/entries';
import { typeClasses } from '@repo/ui/type-classes';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { en } from '../messages/en';
import { BUTTON } from './control-classes';

type Category = keyof typeof en.datePresets.categories;

const CATEGORIES: readonly Category[] = ['year', 'quarter', 'month', 'relative'];

export type DatePresetsProps = {
  readonly today: string | undefined;
  readonly onChoose: (range: DayRange) => void;
};

type Choose = (range: DayRange) => void;

const CHOICE = `whitespace-nowrap rounded px-1.5 py-1 text-left ${typeClasses['body-dense']} hover:bg-ground`;
const IDLE_CHOICE = `${CHOICE} text-text`;
const CURRENT_CHOICE = `${CHOICE} font-semibold text-accent-text underline decoration-accent decoration-2 underline-offset-4`;
const ROW = 'flex items-center gap-1';
const ROW_YEAR = `w-11 shrink-0 ${typeClasses.date} text-text-muted`;

type ChoiceProps = {
  readonly name: string;
  readonly range: DayRange;
  readonly current: boolean;
  readonly onChoose: Choose;
  readonly children: ReactNode;
};

function Choice({ name, range, current, onChoose, children }: ChoiceProps): ReactNode {
  return (
    <button
      type="button"
      aria-label={name}
      aria-current={current ? 'date' : undefined}
      onClick={() => {
        onChoose(range);
      }}
      className={current ? CURRENT_CHOICE : IDLE_CHOICE}
    >
      {children}
    </button>
  );
}

type YearRowProps = {
  readonly current: boolean;
  readonly children: ReactNode;
};

function YearRow({ current, children }: YearRowProps): ReactNode {
  return (
    <div data-current-year={current ? '' : undefined} className={ROW}>
      {children}
    </div>
  );
}

type ChoicesProps = {
  readonly today: string;
  readonly onChoose: Choose;
};

function YearChoices({ today, onChoose }: ChoicesProps): ReactNode {
  const current = currentPeriod(today);
  return yearPresets(today).map((preset) => {
    const isCurrent = preset.year === current.year;
    return (
      <YearRow key={preset.year} current={isCurrent}>
        <Choice name={String(preset.year)} range={preset.range} current={isCurrent} onChoose={onChoose}>
          {preset.year}
        </Choice>
      </YearRow>
    );
  });
}

function QuarterChoices({ today, onChoose }: ChoicesProps): ReactNode {
  const current = currentPeriod(today);
  return quarterPresets(today).map((row) => (
    <YearRow key={row.year} current={row.year === current.year}>
      <span className={ROW_YEAR}>{row.year}</span>
      {row.presets.map((preset) => {
        const quarter = `${en.datePresets.quarterPrefix}${String(preset.quarter)}`;
        return (
          <Choice
            key={preset.quarter}
            name={`${quarter} ${String(preset.year)}`}
            range={preset.range}
            current={preset.year === current.year && preset.quarter === current.quarter}
            onChoose={onChoose}
          >
            {quarter}
          </Choice>
        );
      })}
    </YearRow>
  ));
}

function MonthChoices({ today, onChoose }: ChoicesProps): ReactNode {
  const current = currentPeriod(today);
  return monthPresets(today).map((row) => (
    <YearRow key={row.year} current={row.year === current.year}>
      <span className={ROW_YEAR}>{row.year}</span>
      {row.presets.map((preset) => {
        const month = en.datePresets.months[preset.month - 1] ?? String(preset.month);
        return (
          <Choice
            key={preset.month}
            name={`${month} ${String(preset.year)}`}
            range={preset.range}
            current={preset.year === current.year && preset.month === current.month}
            onChoose={onChoose}
          >
            {month}
          </Choice>
        );
      })}
    </YearRow>
  ));
}

const relativeName = (preset: RelativePreset): string => {
  const unit = preset.months === 1 ? en.datePresets.monthUnit.one : en.datePresets.monthUnit.many;
  return `${en.datePresets.relative[preset.direction]}${String(preset.months)} ${unit}`;
};

function RelativeChoices({ today, onChoose }: ChoicesProps): ReactNode {
  const presets = relativePresets(today);
  return (
    <div className="flex gap-3">
      {RELATIVE_DIRECTIONS.map((direction) => (
        <div key={direction} className="flex flex-col">
          {presets
            .filter((preset) => preset.direction === direction)
            .map((preset) => {
              const name = relativeName(preset);
              return (
                <Choice key={name} name={name} range={preset.range} current={false} onChoose={onChoose}>
                  {name}
                </Choice>
              );
            })}
        </div>
      ))}
    </div>
  );
}

const CHOICES: Readonly<Record<Category, (props: ChoicesProps) => ReactNode>> = {
  year: YearChoices,
  quarter: QuarterChoices,
  month: MonthChoices,
  relative: RelativeChoices,
};

function ChoicesPanel({ id, children }: { readonly id: string; readonly children: ReactNode }): ReactNode {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = panel.current;
    const row = element?.querySelector<HTMLElement>('[data-current-year]');
    if (element && row) {
      element.scrollTop = row.offsetTop - (element.clientHeight - row.offsetHeight) / 2;
    }
  }, []);

  return (
    <div className="absolute top-full left-0 z-10 pt-1.5">
      <div
        ref={panel}
        id={id}
        className="relative flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded border border-border bg-surface p-2"
      >
        {children}
      </div>
    </div>
  );
}

type CategoryMenuProps = {
  readonly category: Category;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

function CategoryMenu({ category, open, onOpen, onClose, children }: CategoryMenuProps): ReactNode {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      onClose();
      trigger.current?.focus();
    }
  };

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      onClose();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onKeyDown={closeOnEscape}
      onBlur={closeWhenFocusLeaves}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onOpen}
        className={`${BUTTON} inline-flex items-center gap-2 ${open ? 'bg-ground' : ''}`}
      >
        {en.datePresets.categories[category]}
        <span aria-hidden="true" className="mb-0.5 size-1.5 rotate-45 border-r-2 border-b-2 border-current" />
      </button>
      {open ? <ChoicesPanel id={panelId}>{children}</ChoicesPanel> : null}
    </div>
  );
}

export function DatePresets({ today, onChoose }: DatePresetsProps): ReactNode {
  const [open, setOpen] = useState<Category>();

  const choose = (range: DayRange): void => {
    setOpen(undefined);
    onChoose(range);
  };

  return (
    <div
      role="group"
      aria-label={en.datePresets.title}
      className="hidden w-full items-center gap-2 border-t border-border pt-3 wide:flex"
    >
      {CATEGORIES.map((category) => {
        const Choices = CHOICES[category];
        return (
          <CategoryMenu
            key={category}
            category={category}
            open={open === category && today !== undefined}
            onOpen={() => {
              setOpen(category);
            }}
            onClose={() => {
              setOpen((shown) => (shown === category ? undefined : shown));
            }}
          >
            {today === undefined ? null : <Choices today={today} onChoose={choose} />}
          </CategoryMenu>
        );
      })}
    </div>
  );
}
