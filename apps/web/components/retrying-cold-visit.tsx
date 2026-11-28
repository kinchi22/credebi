'use client';

import { Fragment, useState, type ReactNode } from 'react';

export type RetryingColdVisitProps = {
  readonly children: (retry: () => void) => ReactNode;
};

export function RetryingColdVisit({ children }: RetryingColdVisitProps): ReactNode {
  const [attempt, setAttempt] = useState(0);
  return (
    <Fragment key={attempt}>
      {children(() => {
        setAttempt((current) => current + 1);
      })}
    </Fragment>
  );
}
