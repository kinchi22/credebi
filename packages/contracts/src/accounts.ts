import { z } from 'zod';
import { type Brand } from './brand';
import { domainError, type DomainError } from './errors';
import { uuidV7Schema } from './id';
import { err, ok, type Result } from './result';

export type AccountId = Brand<string, 'AccountId'>;
export const accountIdSchema = uuidV7Schema.transform((id): AccountId => id as AccountId);

export const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export type AccountGroupId = Brand<string, 'AccountGroupId'>;
export const accountGroupIdSchema = uuidV7Schema.transform(
  (id): AccountGroupId => id as AccountGroupId,
);

export const accountSchema = z.object({
  id: accountIdSchema,
  accountType: accountTypeSchema,
  groupId: accountGroupIdSchema.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  activeFrom: z.iso.date(),
  activeUntil: z.iso.date().nullable(),
});

export type AccountOutput = z.infer<typeof accountSchema>;

export const accountGroupSchema = z.object({
  id: accountGroupIdSchema,
  accountType: accountTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
});

export type AccountGroupOutput = z.infer<typeof accountGroupSchema>;

export const chartNodeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('account'), account: accountSchema }),
  z.object({
    kind: z.literal('group'),
    group: accountGroupSchema,
    accounts: z.array(accountSchema),
  }),
]);

export type ChartNodeOutput = z.infer<typeof chartNodeSchema>;

export const chartSchema = z.array(chartNodeSchema);

export type ChartOutput = z.infer<typeof chartSchema>;

type StoredAccount = {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly groupId: AccountGroupId | null;
  readonly name: string;
  readonly description: string | null;
  readonly activeFrom: string;
  readonly activeUntil: string | null;
};

type StoredGroup = {
  readonly id: AccountGroupId;
  readonly accountType: AccountType;
  readonly name: string;
  readonly description: string | null;
};

type StoredNode =
  | { readonly kind: 'account'; readonly account: StoredAccount }
  | {
      readonly kind: 'group';
      readonly group: StoredGroup;
      readonly accounts: readonly StoredAccount[];
    };

const toAccount = (account: StoredAccount): AccountOutput => ({
  id: account.id,
  accountType: account.accountType,
  groupId: account.groupId,
  name: account.name,
  description: account.description,
  activeFrom: account.activeFrom,
  activeUntil: account.activeUntil,
});

export function toChart(outline: readonly StoredNode[]): ChartOutput {
  return outline.map((node) =>
    node.kind === 'account'
      ? { kind: 'account', account: toAccount(node.account) }
      : {
          kind: 'group',
          group: {
            id: node.group.id,
            accountType: node.group.accountType,
            name: node.group.name,
            description: node.group.description,
          },
          accounts: node.accounts.map(toAccount),
        },
  );
}

export function nodesOfType(
  chart: readonly ChartNodeOutput[],
  accountType: AccountType,
): ChartNodeOutput[] {
  return chart.filter(
    (node) => (node.kind === 'account' ? node.account : node.group).accountType === accountType,
  );
}

export function groupsIn(chart: readonly ChartNodeOutput[]): AccountGroupOutput[] {
  return chart.flatMap((node) => (node.kind === 'group' ? [node.group] : []));
}

export function accountsIn(chart: readonly ChartNodeOutput[]): AccountOutput[] {
  return chart.flatMap((node) => (node.kind === 'account' ? [node.account] : node.accounts));
}

const groupDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type AccountGroupDetailsInput = z.infer<typeof groupDetailsSchema>;

export const addAccountGroupInputSchema = groupDetailsSchema.extend({
  accountType: accountTypeSchema,
});

export type AddAccountGroupInput = z.infer<typeof addAccountGroupInputSchema>;

export const editAccountGroupInputSchema = groupDetailsSchema.extend({
  id: accountGroupIdSchema,
});

export type EditAccountGroupInput = z.infer<typeof editAccountGroupInputSchema>;

const accountDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
  groupId: accountGroupIdSchema.nullable(),
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

export const deleteAccountInputSchema = z.object({
  id: accountIdSchema,
});

export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

export const deleteAccountGroupInputSchema = z.object({
  id: accountGroupIdSchema,
});

export type DeleteAccountGroupInput = z.infer<typeof deleteAccountGroupInputSchema>;

export const ACCOUNT_FORM_FIELDS = {
  name: 'name',
  description: 'description',
  group: 'group',
  activeFrom: 'activeFrom',
  activeUntil: 'activeUntil',
} as const;

type SubmittedForm = {
  readonly get: (name: string) => unknown;
};

const noneIfEmpty = (value: unknown): unknown => (value === '' ? null : value);

export function parseAccountForm(form: SubmittedForm): Result<AccountDetailsInput, DomainError> {
  const parsed = accountDetailsSchema.safeParse({
    name: form.get(ACCOUNT_FORM_FIELDS.name),
    description: form.get(ACCOUNT_FORM_FIELDS.description) ?? '',
    groupId: noneIfEmpty(form.get(ACCOUNT_FORM_FIELDS.group)),
    activeFrom: form.get(ACCOUNT_FORM_FIELDS.activeFrom),
    activeUntil: noneIfEmpty(form.get(ACCOUNT_FORM_FIELDS.activeUntil)),
  });
  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The account form is incomplete or malformed.'));
}

export function parseAccountGroupForm(
  form: SubmittedForm,
): Result<AccountGroupDetailsInput, DomainError> {
  const parsed = groupDetailsSchema.safeParse({
    name: form.get(ACCOUNT_FORM_FIELDS.name),
    description: form.get(ACCOUNT_FORM_FIELDS.description) ?? '',
  });
  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The Account group form is incomplete or malformed.'));
}
