import { type RefObject, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { type PostedEntry } from '@repo/contracts';
import { REDUCED_MOTION_QUERY } from './entry-list';
import { type HeldOpen } from './entry-lines';
import {
  heldOpenAt,
  millisecondsOf,
  shiftFrom,
  spotWithin,
  unfoldedAfterScroll,
  unfoldingIndex,
  unfoldThreshold,
  type Spot,
} from './entry-unfold';

const GHOST_FADE_SHARE = 0.6;

const TITLE_ROW = ':scope > [role="row"]:first-child';

const SIDE_HEADINGS = ':scope > :nth-child(2) > *';

const SIDE_CELLS = ':scope > [role="row"]:nth-child(3) > [role="cell"]';

const LINE = 'li';

const LINE_AMOUNT = 'li > :last-child';

function expansionTiming(): KeyframeAnimationOptions {
  const style = getComputedStyle(document.documentElement);
  return {
    duration: millisecondsOf(style.getPropertyValue('--entry-expansion-duration')),
    easing: style.getPropertyValue('--entry-expansion-easing').trim(),
  };
}

const all = (root: Element, selector: string): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];

function entryIn(list: HTMLElement | null, index: number): HTMLElement | null {
  const entry = list?.querySelectorAll('[role="rowgroup"]')[index];
  return entry instanceof HTMLElement ? entry : null;
}

const cornerOf = (element: Element): Spot => {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top };
};

function ghostOf(entry: HTMLElement): HTMLElement {
  const ghost = entry.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) throw new Error('an Entry clones into an element');
  for (const element of [ghost, ...all(ghost, '*')]) {
    element.removeAttribute('data-testid');
    element.removeAttribute('role');
    element.removeAttribute('id');
    element.style.viewTransitionName = '';
  }
  const box = entry.getBoundingClientRect();
  const style = getComputedStyle(entry);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    margin: '0',
    width: `${String(box.width)}px`,
    height: `${String(box.height - Number.parseFloat(style.borderTopWidth))}px`,
    paddingTop: style.paddingTop,
    borderTopWidth: '0',
    background: 'transparent',
    pointerEvents: 'none',
  });
  for (const hidden of [...all(ghost, TITLE_ROW), ...all(ghost, LINE)]) hidden.style.visibility = 'hidden';
  for (const amount of all(ghost, LINE_AMOUNT)) amount.style.visibility = 'visible';
  return ghost;
}

const fadeIn = (element: Element, timing: KeyframeAnimationOptions): void => {
  element.animate({ opacity: [0, 1] }, timing);
};

function settle(entry: HTMLElement, ghosts: Set<HTMLElement>): void {
  for (const animation of entry.getAnimations({ subtree: true })) animation.finish();
  for (const ghost of ghosts) ghost.remove();
  ghosts.clear();
}

function unfold(entry: HTMLElement, ghosts: Set<HTMLElement>, commit: () => void): void {
  settle(entry, ghosts);
  const timing = expansionTiming();
  const origin = cornerOf(entry);
  const fromHeight = entry.getBoundingClientRect().height;
  const lines = all(entry, LINE);
  const was = lines.map((line) => spotWithin(cornerOf(line), origin));
  const ghost = ghostOf(entry);
  commit();
  entry.append(ghost);
  ghosts.add(ghost);
  const toHeight = entry.getBoundingClientRect().height;
  entry.animate(
    {
      height: [`${String(fromHeight)}px`, `${String(toHeight)}px`],
      overflow: ['clip', 'clip'],
      alignContent: ['start', 'start'],
    },
    timing,
  );
  ghost
    .animate({ opacity: [1, 0] }, { ...timing, duration: Number(timing.duration) * GHOST_FADE_SHARE, fill: 'forwards' })
    .finished.catch(() => undefined)
    .finally(() => {
      ghost.remove();
      ghosts.delete(ghost);
    });
  lines.forEach((line, index) => {
    const before = was[index];
    if (before === undefined) return;
    line.animate({ transform: [shiftFrom(before, spotWithin(cornerOf(line), origin)), 'none'] }, timing);
  });
  for (const shown of [...all(entry, SIDE_HEADINGS), ...all(entry, LINE_AMOUNT)]) fadeIn(shown, timing);
  for (const cell of all(entry, SIDE_CELLS)) {
    const style = getComputedStyle(cell);
    cell.animate(
      {
        borderTopColor: ['transparent', style.borderTopColor],
        borderLeftColor: ['transparent', style.borderLeftColor],
      },
      timing,
    );
  }
}

export type UnfoldingEntry = {
  readonly list: RefObject<HTMLDivElement | null>;
  readonly heldOpen: HeldOpen;
};

export function useUnfoldingEntry(entries: readonly PostedEntry[]): UnfoldingEntry {
  const index = unfoldingIndex(entries);
  const list = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const ghosts = useRef(new Set<HTMLElement>());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const follow = (moving: boolean): void => {
      frame = 0;
      const entry = entryIn(list.current, index);
      if (entry === null) return;
      const threshold = unfoldThreshold({
        entryTop: entry.getBoundingClientRect().top + window.scrollY,
        viewportHeight: window.innerHeight,
      });
      const next = unfoldedAfterScroll(opened.current, { y: window.scrollY, threshold });
      if (next === opened.current) return;
      opened.current = next;
      const commit = (): void => {
        flushSync(() => {
          setOpen(next);
        });
      };
      if (moving && !window.matchMedia(REDUCED_MOTION_QUERY).matches) unfold(entry, ghosts.current, commit);
      else commit();
    };
    const onScroll = (): void => {
      if (frame === 0)
        frame = window.requestAnimationFrame(() => {
          follow(true);
        });
    };
    frame = window.requestAnimationFrame(() => {
      follow(false);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [index]);

  return { list, heldOpen: heldOpenAt(entries, open) };
}
