import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { LandingPage } from '../../components/landing-page';
import { createContext } from '../../server/context';
import { SIGNED_IN_HOME } from '../../server/return-path';
import { createCaller } from '../../server/root-router';
import { chooseLanguage } from './sign-in/actions';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactNode> {
  const caller = createCaller(await createContext());
  if (await caller.auth.signedIn().catch(() => false)) {
    redirect(SIGNED_IN_HOME);
  }

  return <LandingPage chooseLanguage={chooseLanguage} />;
}
