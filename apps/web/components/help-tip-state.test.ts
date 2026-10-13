import { describe, expect, it } from 'vitest';
import { helpTipAfter, isHelpTipOpen, type HelpTipState } from './help-tip-state';

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
