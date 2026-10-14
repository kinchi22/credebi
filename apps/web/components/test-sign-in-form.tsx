import { TEST_SIGN_IN_FIELDS } from '@repo/contracts';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { typeClasses } from '@repo/ui/type-classes';
import { BUTTON, CONTROL } from './control-classes';

export type TestSignInFormProps = {
  readonly returnTo: string;
  readonly action: (form: FormData) => Promise<void>;
};

export async function TestSignInForm({ returnTo, action }: TestSignInFormProps): Promise<ReactNode> {
  const t = await getTranslations('testSignIn');
  return (
    <form action={action} aria-label={t('title')} className="flex flex-col gap-3">
      <h2 className={`${typeClasses.label} text-text-muted`}>{t('title')}</h2>
      <input type="hidden" name={TEST_SIGN_IN_FIELDS.returnTo} value={returnTo} />
      <label className={`flex flex-col gap-1 ${typeClasses['body-sm']}`}>
        {t('identifier')}
        <input name={TEST_SIGN_IN_FIELDS.identifier} required className={CONTROL} />
      </label>
      <label className={`flex flex-col gap-1 ${typeClasses['body-sm']}`}>
        {t('accountsStartOn')}
        <input type="date" name={TEST_SIGN_IN_FIELDS.accountsStartOn} className={CONTROL} />
      </label>
      <button type="submit" className={`self-start ${BUTTON}`}>
        {t('submit')}
      </button>
    </form>
  );
}
