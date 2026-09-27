import { type ReactNode } from 'react';
import { Sidebar } from '../../../components/sidebar';
import { signOut } from './actions';

export default function SignedInLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex flex-col md:flex-row">
      <Sidebar signOut={signOut} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
