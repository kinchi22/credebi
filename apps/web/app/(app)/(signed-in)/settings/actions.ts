'use server';

import {
  accountGroupIdSchema,
  accountIdSchema,
  accountTypeSchema,
  changeEntryFormModeInputSchema,
  moveChartNodeInputSchema,
  parseAccountForm,
  parseAccountGroupForm,
  type DomainError,
  type DomainErrorCode,
  type Result,
} from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { type ChartChange } from '../../../../components/account-dialog';
import { type ChartDeletionOutcome } from '../../../../components/delete-account-dialog';
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

type Caller = ReturnType<typeof createCaller>;

async function refusalOf(change: (caller: Caller) => Promise<void>): Promise<DomainErrorCode | undefined> {
  const caller = createCaller(await createContext());
  try {
    await change(caller);
  } catch (thrown) {
    return fromTrpcError(thrown).code;
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath(SIGNED_IN_HOME);
  revalidatePath(ENTRY_SEARCH_PATH);
  return undefined;
}

async function changeChart<Key, Details>(
  key: Key | undefined,
  details: Result<Details, DomainError>,
  change: (caller: Caller, key: Key, details: Details) => Promise<void>,
): Promise<ChartChange> {
  if (key === undefined || !details.ok) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  const code = await refusalOf((caller) => change(caller, key, details.value));
  return code === undefined ? { outcome: 'saved' } : { outcome: 'rejected', code };
}

async function deleteFromChart<Key>(
  key: Key | undefined,
  remove: (caller: Caller, key: Key) => Promise<void>,
): Promise<ChartDeletionOutcome> {
  if (key === undefined) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  const code = await refusalOf((caller) => remove(caller, key));
  return code === undefined ? { outcome: 'deleted' } : { outcome: 'rejected', code };
}

export async function addAccount(accountType: string, form: FormData): Promise<ChartChange> {
  return changeChart(
    accountTypeSchema.safeParse(accountType).data,
    parseAccountForm(form),
    (caller, type, details) => caller.accounts.add({ ...details, accountType: type }),
  );
}

export async function editAccount(id: string, form: FormData): Promise<ChartChange> {
  return changeChart(
    accountIdSchema.safeParse(id).data,
    parseAccountForm(form),
    (caller, accountId, details) => caller.accounts.edit({ ...details, id: accountId }),
  );
}

export async function addAccountGroup(accountType: string, form: FormData): Promise<ChartChange> {
  return changeChart(
    accountTypeSchema.safeParse(accountType).data,
    parseAccountGroupForm(form),
    (caller, type, details) => caller.accounts.addGroup({ ...details, accountType: type }),
  );
}

export async function editAccountGroup(id: string, form: FormData): Promise<ChartChange> {
  return changeChart(
    accountGroupIdSchema.safeParse(id).data,
    parseAccountGroupForm(form),
    (caller, groupId, details) => caller.accounts.editGroup({ ...details, id: groupId }),
  );
}

export async function deleteAccount(id: string): Promise<ChartDeletionOutcome> {
  return deleteFromChart(accountIdSchema.safeParse(id).data, (caller, accountId) =>
    caller.accounts.delete({ id: accountId }),
  );
}

export async function deleteAccountGroup(id: string): Promise<ChartDeletionOutcome> {
  return deleteFromChart(accountGroupIdSchema.safeParse(id).data, (caller, groupId) =>
    caller.accounts.deleteGroup({ id: groupId }),
  );
}

export async function moveChartNode(move: unknown): Promise<ChartChange> {
  const input = moveChartNodeInputSchema.safeParse(move);
  if (!input.success) {
    return { outcome: 'rejected', code: 'INVALID_INPUT' };
  }

  const code = await refusalOf((caller) => caller.accounts.move(input.data));
  return code === undefined ? { outcome: 'saved' } : { outcome: 'rejected', code };
}
