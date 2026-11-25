import { type Locator, type Page } from '@playwright/test';
import { boxOf } from './accounts';
import { recordAnimations } from './animations';

export type Point = { readonly x: number; readonly y: number };

export type PointerKind = 'touch' | 'mouse' | 'pen';

export type Swipe = {
  readonly dx: number;
  readonly dy?: number;
  readonly from?: Point;
  readonly pointer?: PointerKind;
  readonly cancel?: boolean;
  readonly click?: boolean;
};

export const LEFT = -100;

export const RIGHT = 100;

async function startOf(origin: Locator, gesture: Swipe): Promise<Point> {
  if (gesture.from !== undefined) return gesture.from;
  const box = await boxOf(origin, 'the panel a swipe starts on');
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 120) };
}

export async function swipe(target: Locator, gesture: Swipe, origin: Locator = target): Promise<void> {
  const from = await startOf(origin, gesture);
  const script = `(element) => {
    const from = ${JSON.stringify(from)};
    const dx = ${String(gesture.dx)};
    const dy = ${String(gesture.dy ?? 0)};
    const pointerType = ${JSON.stringify(gesture.pointer ?? 'touch')};
    const cancel = ${String(gesture.cancel === true)};
    const fire = (type, x, y, buttons) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 7,
          pointerType,
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
        }),
      );
    fire('pointerdown', from.x, from.y, 1);
    for (const step of [0.25, 0.5, 0.75, 1]) {
      fire('pointermove', from.x + dx * step, from.y + dy * step, 1);
    }
    fire(cancel ? 'pointercancel' : 'pointerup', from.x + dx, from.y + dy, 0);
    if (${String(gesture.click === true)}) {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  }`;
  await target.evaluate(script);
}

export const tap = (target: Locator, origin: Locator = target): Promise<void> =>
  swipe(target, { dx: 0, click: true }, origin);

const SLIDING = `(animation) => {
  const effect = animation.effect;
  if (effect === null) return false;
  if (String(effect.pseudoElement).startsWith('::view-transition')) return true;
  const target = effect.target;
  if (!(target instanceof Element) || target.querySelector('[role="tablist"]') !== null) return false;
  return [...document.querySelectorAll('[role="tabpanel"]')].some(
    (panel) => panel.contains(target) || target.contains(panel),
  );
}`;

export const recordSlides = (page: Page): Promise<void> => recordAnimations(page, SLIDING);
