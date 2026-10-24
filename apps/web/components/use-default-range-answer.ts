import { type DayRange } from '@repo/core/entries';
import { useEffect, useMemo, useState } from 'react';
import { useBrowserToday } from './use-browser-today';

export const UNAVAILABLE = 'unavailable';

export type DefaultRangeAnswer<Answer> = {
  readonly range: DayRange | undefined;
  readonly rangeKey: string;
  readonly answer: Answer | typeof UNAVAILABLE | undefined;
};

export function useDefaultRangeAnswer<Answer>(
  rangeOf: (today: string) => DayRange,
  ask: (range: DayRange) => Promise<Answer>,
  revision = 0,
): DefaultRangeAnswer<Answer> {
  const today = useBrowserToday();
  const range = useMemo(
    () => (today === undefined ? undefined : rangeOf(today)),
    [today, rangeOf],
  );
  const [answer, setAnswer] = useState<Answer | typeof UNAVAILABLE>();

  useEffect(() => {
    if (range === undefined) {
      return undefined;
    }
    let current = true;
    ask(range).then(
      (found) => {
        if (current) {
          setAnswer(found);
        }
      },
      () => {
        if (current) {
          setAnswer(UNAVAILABLE);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [range, ask, revision]);

  return {
    range,
    rangeKey: range === undefined ? 'today-unknown' : `${range.from}/${range.to}`,
    answer,
  };
}
