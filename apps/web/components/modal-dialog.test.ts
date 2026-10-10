import { describe, expect, it } from 'vitest';
import { scrimPress, type ScrimPress } from './modal-dialog';

const dialog = new EventTarget();
const field = new EventTarget();

const press = (on: ScrimPress, from: EventTarget, to: EventTarget, clickTarget: EventTarget): boolean => {
  on.began(from, dialog);
  on.ended(to, dialog);
  return on.clicked(clickTarget, dialog);
};

describe('scrimPress', () => {
  it('counts a press that starts and ends on the scrim as a click on it', () => {
    expect(press(scrimPress(), dialog, dialog, dialog)).toBe(true);
  });

  it('does not count a press from inside a field released on the scrim', () => {
    expect(press(scrimPress(), field, dialog, dialog)).toBe(false);
  });

  it('does not count a press on the scrim released inside a field', () => {
    expect(press(scrimPress(), dialog, field, dialog)).toBe(false);
  });

  it('does not count a click inside the dialog', () => {
    expect(press(scrimPress(), field, field, field)).toBe(false);
  });

  it('does not count a click on the scrim with no press before it', () => {
    expect(scrimPress().clicked(dialog, dialog)).toBe(false);
  });

  it('judges each press on its own', () => {
    const scrim = scrimPress();
    expect(press(scrim, dialog, dialog, dialog)).toBe(true);
    expect(scrim.clicked(dialog, dialog)).toBe(false);
    expect(press(scrim, field, dialog, dialog)).toBe(false);
    scrim.ended(dialog, dialog);
    expect(scrim.clicked(dialog, dialog)).toBe(false);
    expect(press(scrim, dialog, dialog, dialog)).toBe(true);
  });
});
