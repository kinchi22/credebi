'use server';

import { changeEntryFormModeInputSchema } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { type EntryFormModeChange } from '../../../../components/entry-form-mode-choice';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
import { SETTINGS_PATH } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';

export async function changeEntryFormMode(entryFormMode: string): Promise<EntryFormModeChange> {
  const input = changeEntryFormModeInputSchema.safeParse({ entryFormMode });
  if (!input.success) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  try {
    await createCaller(await createContext()).settings.changeEntryFormMode(input.data);
  } catch (thrown) {
    return { outcome: 'rejected', code: fromTrpcError(thrown).code };
  }

  revalidatePath(SETTINGS_PATH);
  return { outcome: 'saved' };
}
