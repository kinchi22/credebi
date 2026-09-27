'use server';

import { parseEntryForm } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { type EntryFormState } from '../../../../components/entry-form';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
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
