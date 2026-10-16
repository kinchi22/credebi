import { useSyncExternalStore } from 'react';
import { subscribeToNothing } from './hydrated';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

export const localDayOf = (date: Date): string =>
  `${String(date.getFullYear()).padStart(4, '0')}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

const todayInTheBrowser = (): string => localDayOf(new Date());

const todayUnknownOnTheServer = (): undefined => undefined;

export function useBrowserToday(): string | undefined {
  return useSyncExternalStore(subscribeToNothing, todayInTheBrowser, todayUnknownOnTheServer);
}
