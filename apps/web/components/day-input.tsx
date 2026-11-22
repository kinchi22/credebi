import type { ComponentProps, ReactNode } from 'react';

const LAST_DAY = '9999-12-31';

type DayInputProps = Omit<ComponentProps<'input'>, 'type' | 'max'>;

export function DayInput(props: DayInputProps): ReactNode {
  return <input {...props} type="date" max={LAST_DAY} />;
}
