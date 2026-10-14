'use client';

import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';
import { type ReactNode } from 'react';
import { BUTTON } from './control-classes';

export type RefreshButtonProps = {
  readonly action: () => Promise<void>;
};

function SubmitButton(): ReactNode {
  const t = useTranslations();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={BUTTON}
      disabled={pending}
    >
      {pending ? t('refreshButton.pending') : t('refreshButton.idle')}
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
