import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { TOP_BAR_AT_REST, topBarAfterScroll, topBarFrom, topBarShown, type TopBarScroll } from './top-bar-scroll';
import { WIDE_QUERY } from './use-wide';

const scrollEnd = (): number => document.documentElement.scrollHeight - window.innerHeight;

export function useTopBarShown(bar: RefObject<HTMLElement | null>): {
  readonly shown: boolean;
  readonly show: () => void;
} {
  const scroll = useRef(TOP_BAR_AT_REST);
  const [shown, setShown] = useState(TOP_BAR_AT_REST.shown);

  const become = useCallback((next: TopBarScroll): void => {
    scroll.current = next;
    setShown(next.shown);
  }, []);

  const show = useCallback((): void => {
    become(topBarShown(scroll.current));
  }, [become]);

  useEffect(() => {
    const follow = (): void => {
      become(
        topBarAfterScroll(scroll.current, {
          y: window.scrollY,
          end: scrollEnd(),
          barHeight: bar.current?.offsetHeight ?? 0,
        }),
      );
    };
    const wide = window.matchMedia(WIDE_QUERY);
    scroll.current = topBarFrom(window.scrollY);
    window.addEventListener('scroll', follow, { passive: true });
    wide.addEventListener('change', show);
    return () => {
      window.removeEventListener('scroll', follow);
      wide.removeEventListener('change', show);
    };
  }, [bar, become, show]);

  return { shown, show };
}
