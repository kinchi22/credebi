'use server';

import { TEST_SIGN_IN_FIELDS, languageSchema } from '@repo/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createContext } from '../../../server/context';
import { requestLanguage } from '../../../server/i18n-request';
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_OPTIONS } from '../../../server/language-cookie';
import { createCaller } from '../../../server/root-router';
import { returnPath } from '../../../server/return-path';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '../../../server/session-cookie';

export async function signInWithTestIdentifier(form: FormData): Promise<void> {
  const identifier = form.get(TEST_SIGN_IN_FIELDS.identifier);
  const accountsStartOn = form.get(TEST_SIGN_IN_FIELDS.accountsStartOn);
  const caller = createCaller(await createContext());
  const session = await caller.auth.testSignIn({
    identifier: typeof identifier === 'string' ? identifier : '',
    language: await requestLanguage(),
    accountsStartOn:
      typeof accountsStartOn === 'string' && accountsStartOn !== '' ? accountsStartOn : undefined,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
  cookieStore.set(LANGUAGE_COOKIE, session.language, LANGUAGE_COOKIE_OPTIONS);
  redirect(returnPath(form.get(TEST_SIGN_IN_FIELDS.returnTo)));
}

export async function chooseLanguage(language: string): Promise<void> {
  const chosen = languageSchema.safeParse(language);
  if (chosen.success) {
    (await cookies()).set(LANGUAGE_COOKIE, chosen.data, LANGUAGE_COOKIE_OPTIONS);
  }
}
