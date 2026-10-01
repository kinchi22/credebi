import { useSyncExternalStore } from 'react';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

function todayInTheBrowser(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, '0')}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
}

const subscribeToNothing = (): (() => void) => () => undefined;

const todayUnknownOnTheServer = (): undefined => undefined;

export function useBrowserToday(): string | undefined {
  return useSyncExternalStore(subscribeToNothing, todayInTheBrowser, todayUnknownOnTheServer);
}
