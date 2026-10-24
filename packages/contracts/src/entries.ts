import { z } from 'zod';
import {
  accountGroupIdSchema,
  accountIdSchema,
  type AccountGroupId,
  type AccountId,
} from './accounts';
import { type Brand } from './brand';
import { domainError, type DomainError } from './errors';
import { uuidV7Schema } from './id';
import { moneySchema, type Money } from './money';
import { err, ok, type Result } from './result';
import { entryFormModeSchema, type EntryFormMode } from './settings';

export type EntryId = Brand<string, 'EntryId'>;
export const entryIdSchema = uuidV7Schema.transform((id): EntryId => id as EntryId);

export const sideSchema = z.enum(['debit', 'credit']);
export type Side = z.infer<typeof sideSchema>;

export const entryDateSchema = z.iso.date();

export const entryLineSchema = z.object({
  account: z.string(),
  side: sideSchema,
  amount: moneySchema,
});

export type EntryLineInput = z.infer<typeof entryLineSchema>;

export const postedLineSchema = z.object({
  account: accountIdSchema,
  accountName: z.string(),
  side: sideSchema,
  amount: moneySchema,
});

export type PostedLine = z.infer<typeof postedLineSchema>;

export const postEntryInputSchema = z.object({
  entryDate: entryDateSchema,
  title: z.string(),
  memo: z.string(),
  lines: z.array(entryLineSchema),
});

export type PostEntryInput = z.infer<typeof postEntryInputSchema>;

export const deleteEntryInputSchema = z.object({
  id: entryIdSchema,
});

export type DeleteEntryInput = z.infer<typeof deleteEntryInputSchema>;

export const editEntryInputSchema = postEntryInputSchema.extend({
  id: entryIdSchema,
});

export type EditEntryInput = z.infer<typeof editEntryInputSchema>;

export const postedEntrySchema = z.object({
  id: entryIdSchema,
  entryDate: entryDateSchema,
  title: z.string(),
  memo: z.string(),
  lines: z.array(postedLineSchema),
  total: moneySchema,
  createdAt: z.iso.datetime(),
});

export type PostedEntry = z.infer<typeof postedEntrySchema>;

export function toPostedEntry(entry: {
  readonly id: EntryId;
  readonly entryDate: string;
  readonly title: string;
  readonly memo: string;
  readonly lines: readonly {
    readonly account: AccountId;
    readonly accountName: string;
    readonly side: Side;
    readonly amount: Money;
  }[];
  readonly total: Money;
  readonly createdAt: Date;
}): PostedEntry {
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    title: entry.title,
    memo: entry.memo,
    lines: entry.lines.map((line) => ({
      account: line.account,
      accountName: line.accountName,
      side: line.side,
      amount: line.amount,
    })),
    total: entry.total,
    createdAt: entry.createdAt.toISOString(),
  };
}

export const titleLineSchema = postedLineSchema.omit({ accountName: true });

export type TitleLine = z.infer<typeof titleLineSchema>;

export const suggestedAccountsSchema = z.object({
  debit: z.array(accountIdSchema),
  credit: z.array(accountIdSchema),
});

export type SuggestedAccounts = z.infer<typeof suggestedAccountsSchema>;

export const offeredTitleSchema = z.object({
  title: z.string(),
  lines: z.array(titleLineSchema),
  suggested: suggestedAccountsSchema,
});

export type OfferedTitle = z.infer<typeof offeredTitleSchema>;

export const SEARCH_CRITERIA_FIELDS = {
  from: 'from',
  to: 'to',
  account: 'account',
  title: 'title',
  memo: 'memo',
} as const;

export const searchCriteriaSchema = z.object({
  from: entryDateSchema.optional(),
  to: entryDateSchema.optional(),
  account: z.string().optional(),
  title: z.string().optional(),
  memo: z.string().optional(),
});

export type SearchCriteriaInput = z.infer<typeof searchCriteriaSchema>;

export type SearchQuery = {
  readonly [name: string]: string | readonly string[] | undefined;
};

const asked = (value: SearchQuery[string]): SearchQuery[string] =>
  value === '' ? undefined : value;

export function parseSearchQuery(query: SearchQuery): Result<SearchCriteriaInput, DomainError> {
  const parsed = searchCriteriaSchema.safeParse({
    from: asked(query[SEARCH_CRITERIA_FIELDS.from]),
    to: asked(query[SEARCH_CRITERIA_FIELDS.to]),
    account: asked(query[SEARCH_CRITERIA_FIELDS.account]),
    title: asked(query[SEARCH_CRITERIA_FIELDS.title]),
    memo: asked(query[SEARCH_CRITERIA_FIELDS.memo]),
  });

  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The search criteria are malformed.'));
}

export const INCOME_STATEMENT_FIELDS = {
  from: 'from',
  to: 'to',
} as const;

export const incomeStatementQuerySchema = z.object({
  from: entryDateSchema,
  to: entryDateSchema,
});

export type IncomeStatementQuery = z.infer<typeof incomeStatementQuerySchema>;

export function parseIncomeStatementQuery(
  query: SearchQuery,
): Result<IncomeStatementQuery, DomainError> {
  const parsed = incomeStatementQuerySchema.safeParse({
    from: query[INCOME_STATEMENT_FIELDS.from],
    to: query[INCOME_STATEMENT_FIELDS.to],
  });

  return parsed.success
    ? ok(parsed.data)
    : err(domainError('INVALID_INPUT', 'The statement period is malformed.'));
}

export const statementAccountSchema = z.object({
  kind: z.literal('account'),
  account: accountIdSchema,
  name: z.string(),
  total: moneySchema,
});

export type StatementAccountOutput = z.infer<typeof statementAccountSchema>;

export const statementGroupSchema = z.object({
  kind: z.literal('group'),
  group: accountGroupIdSchema,
  name: z.string(),
  total: moneySchema,
  accounts: z.array(statementAccountSchema),
});

export type StatementGroupOutput = z.infer<typeof statementGroupSchema>;

export const statementRowSchema = z.discriminatedUnion('kind', [
  statementAccountSchema,
  statementGroupSchema,
]);

export type StatementRowOutput = z.infer<typeof statementRowSchema>;

export const statementSectionSchema = z.object({
  total: moneySchema,
  rows: z.array(statementRowSchema),
});

export type StatementSectionOutput = z.infer<typeof statementSectionSchema>;

export const incomeStatementSchema = z.object({
  revenue: statementSectionSchema,
  expense: statementSectionSchema,
  difference: moneySchema,
});

export type IncomeStatementOutput = z.infer<typeof incomeStatementSchema>;

type BuiltStatementAccount = {
  readonly kind: 'account';
  readonly account: AccountId;
  readonly name: string;
  readonly total: Money;
};

type BuiltStatementRow =
  | BuiltStatementAccount
  | {
      readonly kind: 'group';
      readonly group: AccountGroupId;
      readonly name: string;
      readonly total: Money;
      readonly accounts: readonly BuiltStatementAccount[];
    };

type BuiltStatementSection = {
  readonly total: Money;
  readonly rows: readonly BuiltStatementRow[];
};

const toStatementAccount = ({
  kind,
  account,
  name,
  total,
}: BuiltStatementAccount): StatementAccountOutput => ({ kind, account, name, total });

const toStatementRow = (row: BuiltStatementRow): StatementRowOutput =>
  row.kind === 'account'
    ? toStatementAccount(row)
    : {
        kind: row.kind,
        group: row.group,
        name: row.name,
        total: row.total,
        accounts: row.accounts.map(toStatementAccount),
      };

const toStatementSection = ({ total, rows }: BuiltStatementSection): StatementSectionOutput => ({
  total,
  rows: rows.map(toStatementRow),
});

export function toIncomeStatement(statement: {
  readonly revenue: BuiltStatementSection;
  readonly expense: BuiltStatementSection;
  readonly difference: Money;
}): IncomeStatementOutput {
  return {
    revenue: toStatementSection(statement.revenue),
    expense: toStatementSection(statement.expense),
    difference: statement.difference,
  };
}

export const ENTRY_FORM_FIELDS = {
  entryFormMode: 'entryFormMode',
  entryDate: 'entryDate',
  title: 'title',
  memo: 'memo',
  account: 'account',
  side: 'side',
  amount: 'amount',
  debitAccount: 'debitAccount',
  creditAccount: 'creditAccount',
} as const;

export type SubmittedFields = {
  readonly get: (name: string) => unknown;
  readonly getAll: (name: string) => readonly unknown[];
};

export const amountTextSchema = z.string().regex(/^[0-9]+$/);

const typedAmountSchema = amountTextSchema.transform(Number).pipe(moneySchema);

const multiLineFormSchema = z.object({
  entryDate: entryDateSchema,
  title: z.string(),
  memo: z.string(),
  lines: z.array(
    z.object({
      account: z.string(),
      side: sideSchema,
      amount: typedAmountSchema,
    }),
  ),
});

const refusedForm = (): Result<PostEntryInput, DomainError> =>
  err(domainError('INVALID_INPUT', 'The entry form is incomplete or malformed.'));

export function parseMultiLineEntryForm(
  form: SubmittedFields,
): Result<PostEntryInput, DomainError> {
  const accounts = form.getAll(ENTRY_FORM_FIELDS.account);
  const sides = form.getAll(ENTRY_FORM_FIELDS.side);
  const amounts = form.getAll(ENTRY_FORM_FIELDS.amount);
  const lineCount = Math.max(accounts.length, sides.length, amounts.length);

  const parsed = multiLineFormSchema.safeParse({
    entryDate: form.get(ENTRY_FORM_FIELDS.entryDate),
    title: form.get(ENTRY_FORM_FIELDS.title),
    memo: form.get(ENTRY_FORM_FIELDS.memo),
    lines: Array.from({ length: lineCount }, (_, index) => ({
      account: accounts[index],
      side: sides[index],
      amount: amounts[index],
    })),
  });

  return parsed.success ? ok(parsed.data) : refusedForm();
}

const twoLineFormSchema = z.object({
  entryDate: entryDateSchema,
  title: z.string(),
  memo: z.string(),
  debitAccount: z.string(),
  creditAccount: z.string(),
  amount: typedAmountSchema,
});

export function parseTwoLineEntryForm(form: SubmittedFields): Result<PostEntryInput, DomainError> {
  const parsed = twoLineFormSchema.safeParse({
    entryDate: form.get(ENTRY_FORM_FIELDS.entryDate),
    title: form.get(ENTRY_FORM_FIELDS.title),
    memo: form.get(ENTRY_FORM_FIELDS.memo),
    debitAccount: form.get(ENTRY_FORM_FIELDS.debitAccount),
    creditAccount: form.get(ENTRY_FORM_FIELDS.creditAccount),
    amount: form.get(ENTRY_FORM_FIELDS.amount),
  });
  if (!parsed.success) return refusedForm();

  const { entryDate, title, memo, debitAccount, creditAccount, amount } = parsed.data;
  return ok({
    entryDate,
    title,
    memo,
    lines: [
      { account: debitAccount, side: 'debit', amount },
      { account: creditAccount, side: 'credit', amount },
    ],
  });
}

const PARSE_BY_MODE: Readonly<
  Record<EntryFormMode, (form: SubmittedFields) => Result<PostEntryInput, DomainError>>
> = {
  'two-line': parseTwoLineEntryForm,
  'multi-line': parseMultiLineEntryForm,
};

export function parseEntryForm(form: SubmittedFields): Result<PostEntryInput, DomainError> {
  const mode = entryFormModeSchema.safeParse(form.get(ENTRY_FORM_FIELDS.entryFormMode));
  return mode.success ? PARSE_BY_MODE[mode.data](form) : refusedForm();
}
