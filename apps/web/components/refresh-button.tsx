'use client';

import { useFormStatus } from 'react-dom';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import { BUTTON } from './control-classes';

export type RefreshButtonProps = {
  readonly action: () => Promise<void>;
};

function SubmitButton(): ReactNode {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={BUTTON}
      disabled={pending}
    >
      {pending ? en.refreshButton.pending : en.refreshButton.idle}
    </button>
  );
}

export function RefreshButton({ action }: RefreshButtonProps): ReactNode {
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}
