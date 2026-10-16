import { useSyncExternalStore } from 'react';

export const subscribeToNothing = (): (() => void) => () => undefined;

const hydratedInTheBrowser = (): boolean => true;

const notHydratedOnTheServer = (): boolean => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, hydratedInTheBrowser, notHydratedOnTheServer);
}
