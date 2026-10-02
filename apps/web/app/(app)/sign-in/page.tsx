import { GoogleMark, Logo, PANEL } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { DANGER_TEXT } from '../../../components/text-classes';
import { TestSignInForm } from '../../../components/test-sign-in-form';
import { en } from '../../../messages/en';
import { createContext } from '../../../server/context';
import { returnPath } from '../../../server/return-path';
import { createCaller } from '../../../server/root-router';
import { signInWithTestIdentifier } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: en.signInPage.title,
};

type SignInPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps): Promise<ReactNode> {
  const query = await searchParams;
  const returnTo = returnPath(query['returnTo']);
  const caller = createCaller(await createContext());
  const testSignInOffered = await caller.auth.testSignInOffered();

  return (
    <main className="flex min-h-screen items-center justify-center p-4 wide:p-8">
      <div className={`flex w-full flex-col gap-6 ${PANEL} px-5 py-7 wide:w-100 wide:px-10 wide:py-10`}>
        <div className="flex justify-center">
          <Logo variant="stacked" tone="color" name={en.app.name} height={112} />
        </div>
        <h1 className={`mt-2 text-center ${typeClasses.h2}`}>{en.signInPage.title}</h1>
        {query['error'] === undefined ? null : (
          <p role="alert" className={`text-center ${DANGER_TEXT}`}>
            {en.signInPage.failed}
          </p>
        )}
        <a
          href={`/sign-in/google?${new URLSearchParams({ returnTo }).toString()}`}
          className={`flex h-10 items-center justify-center gap-2.5 rounded border border-border-google bg-surface px-4 ${typeClasses['body-sm']} font-semibold text-text`}
        >
          <GoogleMark />
          {en.signInPage.google}
        </a>
        {testSignInOffered ? (
          <div className="border-t border-dashed border-border pt-5">
            <TestSignInForm returnTo={returnTo} action={signInWithTestIdentifier} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
