'use server';

import { deleteEntryInputSchema, parseEntryForm } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { type EntryDeletion } from '../../../../components/delete-entry';
import { type EntryFormState } from '../../../../components/entry-form';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
import { ENTRY_SEARCH_PATH, SIGNED_IN_HOME } from '../../../../server/return-path';
import { createCaller } from '../../../../server/root-router';

export async function postEntry(
  _previous: EntryFormState,
  form: FormData,
): Promise<EntryFormState> {
  const input = parseEntryForm(form);
  if (!input.ok) {
    return { outcome: 'rejected', code: input.error.code };
  }

  try {
    await createCaller(await createContext()).entries.post(input.value);
  } catch (thrown) {
    return { outcome: 'rejected', code: fromTrpcError(thrown).code };
  }

  revalidatePath('/entries');
  return { outcome: 'saved' };
}

export async function deleteEntry(id: string): Promise<EntryDeletion> {
  const input = deleteEntryInputSchema.safeParse({ id });
  if (!input.success) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  try {
    await createCaller(await createContext()).entries.delete(input.data);
  } catch (thrown) {
    return { outcome: 'rejected', code: fromTrpcError(thrown).code };
  }

  revalidatePath(SIGNED_IN_HOME);
  revalidatePath(ENTRY_SEARCH_PATH);
  return { outcome: 'deleted' };
}
