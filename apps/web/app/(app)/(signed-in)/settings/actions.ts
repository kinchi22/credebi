'use server';

import {
  accountGroupIdSchema,
  accountIdSchema,
  accountTypeSchema,
  changeEntryFormModeInputSchema,
  parseAccountForm,
  parseAccountGroupForm,
  type DomainError,
  type Result,
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

type Parsed<Value> =
  | { readonly success: true; readonly data: Value }
  | { readonly success: false };

type Caller = ReturnType<typeof createCaller>;

async function changeChart<Key, Details>(
  key: Parsed<Key>,
  details: Result<Details, DomainError>,
  change: (caller: Caller, key: Key, details: Details) => Promise<void>,
): Promise<AccountChange> {
  if (!key.success || !details.ok) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  const caller = createCaller(await createContext());
  try {
    await change(caller, key.data, details.value);
  } catch (thrown) {
    return { outcome: 'rejected', code: fromTrpcError(thrown).code };
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(SIGNED_IN_HOME);
  revalidatePath(ENTRY_SEARCH_PATH);
  return { outcome: 'saved' };
}

export async function addAccount(accountType: string, form: FormData): Promise<AccountChange> {
  return changeChart(
    accountTypeSchema.safeParse(accountType),
    parseAccountForm(form),
    (caller, type, details) => caller.accounts.add({ ...details, accountType: type }),
  );
}

export async function editAccount(id: string, form: FormData): Promise<AccountChange> {
  return changeChart(
    accountIdSchema.safeParse(id),
    parseAccountForm(form),
    (caller, accountId, details) => caller.accounts.edit({ ...details, id: accountId }),
  );
}

export async function addAccountGroup(accountType: string, form: FormData): Promise<AccountChange> {
  return changeChart(
    accountTypeSchema.safeParse(accountType),
    parseAccountGroupForm(form),
    (caller, type, details) => caller.accounts.addGroup({ ...details, accountType: type }),
  );
}

export async function editAccountGroup(id: string, form: FormData): Promise<AccountChange> {
  return changeChart(
    accountGroupIdSchema.safeParse(id),
    parseAccountGroupForm(form),
    (caller, groupId, details) => caller.accounts.editGroup({ ...details, id: groupId }),
  );
}
