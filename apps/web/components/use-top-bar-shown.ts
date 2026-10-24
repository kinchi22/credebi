import { useCallback, useEffect, useState } from 'react';
import { TOP_BAR_AT_REST, topBarAfterScroll } from './top-bar-scroll';

const scrollEnd = (): number => document.documentElement.scrollHeight - window.innerHeight;

export function useTopBarShown(): { readonly shown: boolean; readonly show: () => void } {
  const [state, setState] = useState(TOP_BAR_AT_REST);

  useEffect(() => {
    const follow = (): void => {
      setState((previous) => topBarAfterScroll(previous, window.scrollY, scrollEnd()));
    };
    window.addEventListener('scroll', follow, { passive: true });
    return () => {
      window.removeEventListener('scroll', follow);
    };
  }, []);

  const show = useCallback((): void => {
    setState((previous) => ({ ...previous, shown: true }));
  }, []);

  return { shown: state.shown, show };
}
