import { type ReactNode } from 'react';
import { Sidebar } from '../../../components/sidebar';
import { signOut } from './actions';

export default function SignedInLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-screen flex-col wide:flex-row">
      <Sidebar signOut={signOut} />
      <main className="mx-auto flex max-w-2xl min-w-0 flex-1 flex-col gap-4 p-8">
        {children}
      </main>
    </div>
  );
}
