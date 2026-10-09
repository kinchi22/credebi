import { z } from 'zod';
import { type Brand } from './brand';
import { uuidV7Schema } from './id';

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
