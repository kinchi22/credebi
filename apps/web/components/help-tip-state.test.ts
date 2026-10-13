import { describe, expect, it } from 'vitest';
import {
  helpTipAfter,
  helpTipMaxWidth,
  helpTipShift,
  isHelpTipOpen,
  type HelpTipState,
} from './help-tip-state';

const STATES: readonly HelpTipState[] = ['closed', 'hovered', 'pinned'];

describe('helpTipAfter', () => {
  it('opens a closed Help tip on hover, and keeps an open one as it is', () => {
    expect(helpTipAfter('closed', 'enter')).toBe('hovered');
    expect(helpTipAfter('hovered', 'enter')).toBe('hovered');
    expect(helpTipAfter('pinned', 'enter')).toBe('pinned');
  });

  it('closes a Help tip opened by hover when the pointer leaves, and keeps one opened by a click', () => {
    expect(helpTipAfter('hovered', 'leave')).toBe('closed');
    expect(helpTipAfter('pinned', 'leave')).toBe('pinned');
    expect(helpTipAfter('closed', 'leave')).toBe('closed');
  });

  it('pins a Help tip on a click whether it was closed or opened by hover, and closes a pinned one', () => {
    expect(helpTipAfter('closed', 'toggle')).toBe('pinned');
    expect(helpTipAfter('hovered', 'toggle')).toBe('pinned');
    expect(helpTipAfter('pinned', 'toggle')).toBe('closed');
  });

  it('closes a Help tip on Escape or a click outside however it was opened', () => {
    for (const state of STATES) {
      expect(helpTipAfter(state, 'dismiss')).toBe('closed');
    }
  });
});

describe('isHelpTipOpen', () => {
  it('shows the explanation while hovered or pinned, never while closed', () => {
    expect(STATES.map(isHelpTipOpen)).toEqual([false, true, true]);
  });
});

describe('helpTipShift', () => {
  it('leaves a panel in place while it ends 24px or more inside the screen', () => {
    expect(helpTipShift({ left: 40, width: 256 }, 390)).toBe(0);
    expect(helpTipShift({ left: 110, width: 256 }, 390)).toBe(0);
  });

  it('shifts a panel left by as much as it runs past the 24px gutter on the right', () => {
    expect(helpTipShift({ left: 111, width: 256 }, 390)).toBe(-1);
    expect(helpTipShift({ left: 200, width: 256 }, 390)).toBe(-90);
  });

  it('never shifts a panel past the 24px gutter on the left', () => {
    expect(helpTipShift({ left: 100, width: 330 }, 360)).toBe(-76);
    expect(helpTipShift({ left: 24, width: 330 }, 360)).toBe(0);
  });
});

describe('helpTipMaxWidth', () => {
  it('keeps a 24px gutter on each side of the screen', () => {
    expect(helpTipMaxWidth(390)).toBe(342);
    expect(helpTipMaxWidth(1280)).toBe(1232);
  });
});
