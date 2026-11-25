import { type Locator } from '@playwright/test';
import { boxOf } from './accounts';

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

type Dispatcher = { readonly dispatchEvent: (event: unknown) => boolean };

export const LEFT = -100;

export const RIGHT = 100;

async function startOf(origin: Locator, gesture: Swipe): Promise<Point> {
  if (gesture.from !== undefined) return gesture.from;
  const box = await boxOf(origin, 'the panel a swipe starts on');
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 120) };
}

export async function swipe(target: Locator, gesture: Swipe, origin: Locator = target): Promise<void> {
  const from = await startOf(origin, gesture);
  await target.evaluate(
    (element: Dispatcher, { from, dx, dy, pointerType, cancel, click }) => {
      const { PointerEvent, MouseEvent } = globalThis as unknown as {
        readonly PointerEvent: new (type: string, init: Record<string, unknown>) => unknown;
        readonly MouseEvent: new (type: string, init: Record<string, unknown>) => unknown;
      };
      const fire = (type: string, x: number, y: number, buttons: number): boolean =>
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
      if (click) {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    },
    {
      from,
      dx: gesture.dx,
      dy: gesture.dy ?? 0,
      pointerType: gesture.pointer ?? 'touch',
      cancel: gesture.cancel === true,
      click: gesture.click === true,
    },
  );
}

export const tap = (target: Locator, origin: Locator = target): Promise<void> =>
  swipe(target, { dx: 0, click: true }, origin);
