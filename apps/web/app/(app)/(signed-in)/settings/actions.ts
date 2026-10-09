'use server';

import {
  accountIdSchema,
  accountTypeSchema,
  changeEntryFormModeInputSchema,
  parseAccountForm,
} from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { type AccountChange } from '../../../../components/account-dialog';
import { type EntryFormModeChange } from '../../../../components/entry-form-mode-choice';
import { createContext } from '../../../../server/context';
import { fromTrpcError } from '../../../../server/domain-error';
import {
  ENTRY_SEARCH_PATH,
  SETTINGS_PATH,
  SIGNED_IN_HOME,
} from '../../../../server/return-path';
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

async function changeChart(change: () => Promise<void>): Promise<AccountChange> {
  try {
    await change();
  } catch (thrown) {
    return { outcome: 'rejected', code: fromTrpcError(thrown).code };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(SIGNED_IN_HOME);
  revalidatePath(ENTRY_SEARCH_PATH);
  return { outcome: 'saved' };
}

export async function addAccount(accountType: string, form: FormData): Promise<AccountChange> {
  const type = accountTypeSchema.safeParse(accountType);
  const details = parseAccountForm(form);
  if (!type.success || !details.ok) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  const caller = createCaller(await createContext());
  return changeChart(() => caller.accounts.add({ ...details.value, accountType: type.data }));
}

export async function editAccount(id: string, form: FormData): Promise<AccountChange> {
  const accountId = accountIdSchema.safeParse(id);
  const details = parseAccountForm(form);
  if (!accountId.success || !details.ok) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  const caller = createCaller(await createContext());
  return changeChart(() => caller.accounts.edit({ ...details.value, id: accountId.data }));
}
