import { TEST_SIGN_IN_FIELDS } from '@repo/contracts';
import { type ReactNode } from 'react';
import { typeClasses } from '@repo/ui/type-classes';
import { en } from '../messages/en';
import { BUTTON, CONTROL } from './control-classes';

export type TestSignInFormProps = {
  readonly returnTo: string;
  readonly action: (form: FormData) => Promise<void>;
};

export function TestSignInForm({ returnTo, action }: TestSignInFormProps): ReactNode {
  return (
    <form action={action} aria-label={en.testSignIn.title} className="flex flex-col gap-3">
      <h2 className={`${typeClasses.label} text-text-muted`}>{en.testSignIn.title}</h2>
      <input type="hidden" name={TEST_SIGN_IN_FIELDS.returnTo} value={returnTo} />
      <label className={`flex flex-col gap-1 ${typeClasses['body-sm']}`}>
        {en.testSignIn.identifier}
        <input name={TEST_SIGN_IN_FIELDS.identifier} required className={CONTROL} />
      </label>
      <button type="submit" className={`self-start ${BUTTON}`}>
        {en.testSignIn.submit}
      </button>
    </form>
  );
}
