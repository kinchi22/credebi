'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createContext } from '../../../../../server/context';
import { fromTrpcError } from '../../../../../server/domain-error';
import { AUTHORIZE_PATH, requestOrigin } from '../../../../../server/oauth';
import { signInPath } from '../../../../../server/return-path';
import { createCaller } from '../../../../../server/root-router';

type Decision = 'approveAuthorization' | 'denyAuthorization';

async function decide(decision: Decision, query: string): Promise<never> {
  const input = { query, origin: requestOrigin(await headers()) };
  const caller = createCaller(await createContext());
  let location: string;
  try {
    ({ location } = await caller.auth[decision](input));
  } catch (thrown) {
    const path = `${AUTHORIZE_PATH}${query}`;
    const { code } = fromTrpcError(thrown);
    if (code === 'UNAUTHENTICATED') {
      redirect(signInPath(path));
    }
    if (code === 'INVALID_INPUT') {
      redirect(path);
    }
    throw thrown;
  }
  redirect(location);
}

export async function approve(query: string): Promise<never> {
  return decide('approveAuthorization', query);
}

export async function deny(query: string): Promise<never> {
  return decide('denyAuthorization', query);
}
