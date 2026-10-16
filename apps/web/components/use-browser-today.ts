import { useSyncExternalStore } from 'react';
import { localDayOf } from './local-day';
import { subscribeToNothing } from './use-hydrated';

const todayInTheBrowser = (): string => localDayOf(new Date());

const todayUnknownOnTheServer = (): undefined => undefined;

export function useBrowserToday(): string | undefined {
  return useSyncExternalStore(subscribeToNothing, todayInTheBrowser, todayUnknownOnTheServer);
}
