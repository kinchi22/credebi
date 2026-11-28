import 'server-only';
import { cache } from 'react';
import { createContext } from './context';
import { createCaller } from './root-router';
import { orSignIn } from './sign-in-redirect';

export type RequestCaller = Awaited<ReturnType<typeof callerOfRequest>>;

const callerOfRequest = cache(async () => createCaller(await createContext()));

export async function readOfRequest<T>(
  returnPath: string,
  read: (caller: RequestCaller) => Promise<T>,
): Promise<T> {
  return orSignIn(read(await callerOfRequest()), returnPath);
}
