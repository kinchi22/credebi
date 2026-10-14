import { describe, expect, it } from 'vitest';
import { ACROSS_STEPS, DOWN_STEPS } from './roving-focus';

const stepped = (steps: typeof ACROSS_STEPS, key: string, index: number): number | undefined =>
  steps[key]?.(index, 3);

describe('ACROSS_STEPS', () => {
  it('moves left and right, wrapping at either end, and jumps to the first and the last', () => {
    expect(stepped(ACROSS_STEPS, 'ArrowRight', 0)).toBe(1);
    expect(stepped(ACROSS_STEPS, 'ArrowRight', 2)).toBe(0);
    expect(stepped(ACROSS_STEPS, 'ArrowLeft', 1)).toBe(0);
    expect(stepped(ACROSS_STEPS, 'ArrowLeft', 0)).toBe(2);
    expect(stepped(ACROSS_STEPS, 'Home', 2)).toBe(0);
    expect(stepped(ACROSS_STEPS, 'End', 0)).toBe(2);
  });

  it('takes no vertical key', () => {
    expect(stepped(ACROSS_STEPS, 'ArrowDown', 0)).toBeUndefined();
    expect(stepped(ACROSS_STEPS, 'ArrowUp', 0)).toBeUndefined();
  });
});

describe('DOWN_STEPS', () => {
  it('moves down and up, wrapping at either end, and jumps to the first and the last', () => {
    expect(stepped(DOWN_STEPS, 'ArrowDown', 0)).toBe(1);
    expect(stepped(DOWN_STEPS, 'ArrowDown', 2)).toBe(0);
    expect(stepped(DOWN_STEPS, 'ArrowUp', 1)).toBe(0);
    expect(stepped(DOWN_STEPS, 'ArrowUp', 0)).toBe(2);
    expect(stepped(DOWN_STEPS, 'Home', 2)).toBe(0);
    expect(stepped(DOWN_STEPS, 'End', 0)).toBe(2);
  });

  it('takes no horizontal key', () => {
    expect(stepped(DOWN_STEPS, 'ArrowLeft', 0)).toBeUndefined();
    expect(stepped(DOWN_STEPS, 'ArrowRight', 0)).toBeUndefined();
  });
});
