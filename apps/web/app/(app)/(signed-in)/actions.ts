'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { keepCollapsedGroup } from '../../../server/collapsed-group';
import { createContext } from '../../../server/context';
import { createCaller } from '../../../server/root-router';
import { SESSION_COOKIE } from '../../../server/session-cookie';

export async function signOut(): Promise<void> {
  await createCaller(await createContext()).auth.signOut();
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}

export async function keepCollapsed(id: unknown, collapsed: unknown): Promise<void> {
  const context = await createContext();
  const caller = createCaller(context);
  await keepCollapsedGroup(
    (input) => caller.accounts.collapseGroup(input),
    context.container.logger,
    id,
    collapsed,
  );
}
