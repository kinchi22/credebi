import { z } from 'zod';
import { type Brand } from './brand';
import { domainError, type DomainError } from './errors';
import { uuidV7Schema } from './id';
import { err, ok, type Result } from './result';

export type AccountId = Brand<string, 'AccountId'>;
export const accountIdSchema = uuidV7Schema.transform((id): AccountId => id as AccountId);

export const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const accountSchema = z.object({
  id: accountIdSchema,
  accountType: accountTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  activeFrom: z.iso.date(),
  activeUntil: z.iso.date().nullable(),
});

export type AccountOutput = z.infer<typeof accountSchema>;

export const chartSchema = z.array(accountSchema);

export type ChartOutput = z.infer<typeof chartSchema>;

export function toChart(
  accounts: readonly {
    readonly id: AccountId;
    readonly accountType: AccountType;
    readonly name: string;
    readonly description: string | null;
    readonly activeFrom: string;
    readonly activeUntil: string | null;
  }[],
): ChartOutput {
  return accounts.map((account) => ({
    id: account.id,
    accountType: account.accountType,
    name: account.name,
    description: account.description,
    activeFrom: account.activeFrom,
    activeUntil: account.activeUntil,
  }));
}

const accountDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
  activeFrom: z.iso.date(),
  activeUntil: z.iso.date().nullable(),
});

export type AccountDetailsInput = z.infer<typeof accountDetailsSchema>;

export const addAccountInputSchema = accountDetailsSchema.extend({
  accountType: accountTypeSchema,
});

export type AddAccountInput = z.infer<typeof addAccountInputSchema>;

export const editAccountInputSchema = accountDetailsSchema.extend({
  id: accountIdSchema,
});

export type EditAccountInput = z.infer<typeof editAccountInputSchema>;

export const ACCOUNT_FORM_FIELDS = {
  name: 'name',
  description: 'description',
  activeFrom: 'activeFrom',
  activeUntil: 'activeUntil',
} as const;

export function parseAccountForm(form: {
  readonly get: (name: string) => unknown;
}): Result<AccountDetailsInput, DomainError> {
  const activeUntil = form.get(ACCOUNT_FORM_FIELDS.activeUntil);
  const parsed = accountDetailsSchema.safeParse({
    name: form.get(ACCOUNT_FORM_FIELDS.name),
    description: form.get(ACCOUNT_FORM_FIELDS.description) ?? '',
    activeFrom: form.get(ACCOUNT_FORM_FIELDS.activeFrom),
    activeUntil: activeUntil === '' || activeUntil === null ? null : activeUntil,
  });
  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The account form is incomplete or malformed.'));
}
