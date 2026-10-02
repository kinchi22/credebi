import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { Sidebar } from '../../../components/sidebar';
import { createContext } from '../../../server/context';
import { signInPathFor } from '../../../server/return-path';
import { createCaller } from '../../../server/root-router';
import { signOut } from './actions';

export default async function SignedInLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  if (!(await createCaller(await createContext()).auth.signedIn())) {
    redirect(signInPathFor(await headers()));
  }
  return (
    <div className="flex min-h-screen flex-col wide:flex-row">
      <Sidebar signOut={signOut} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 wide:px-14 wide:py-10">
        {children}
      </main>
    </div>
  );
}
