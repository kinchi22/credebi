const KEYBOARD_CLICK = 0;

export function focusAfterClick(clickCount: number): FocusOptions {
  return clickCount === KEYBOARD_CLICK ? {} : { focusVisible: false };
}
