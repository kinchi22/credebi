const KEYBOARD_CLICK = 0;

export type FocusReturn = {
  readonly options: FocusOptions;
  readonly afresh: boolean;
};

export const BROWSER_FOCUS_RETURN: FocusReturn = { options: {}, afresh: false };

const RINGLESS_FOCUS_RETURN: FocusReturn = { options: { focusVisible: false }, afresh: true };

export function focusAfterClick(clickCount: number): FocusReturn {
  return clickCount === KEYBOARD_CLICK ? BROWSER_FOCUS_RETURN : RINGLESS_FOCUS_RETURN;
}
