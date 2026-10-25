import { useEffect, useMemo, useState } from 'react';
import { useBrowserToday } from './use-browser-today';

export const UNAVAILABLE = 'unavailable';

export type DefaultAnswer<Asked, Answer> = {
  readonly asked: Asked | undefined;
  readonly todayKey: string;
  readonly answer: Answer | typeof UNAVAILABLE | undefined;
};

export function useDefaultAnswer<Asked, Answer>(
  askedOf: (today: string) => Asked,
  ask: (asked: Asked) => Promise<Answer>,
  revision = 0,
): DefaultAnswer<Asked, Answer> {
  const today = useBrowserToday();
  const asked = useMemo(
    () => (today === undefined ? undefined : askedOf(today)),
    [today, askedOf],
  );
  const [answer, setAnswer] = useState<Answer | typeof UNAVAILABLE>();

  useEffect(() => {
    if (asked === undefined) {
      return undefined;
    }
    let current = true;
    ask(asked).then(
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
  }, [asked, ask, revision]);

  return { asked, todayKey: today ?? 'today-unknown', answer };
}
