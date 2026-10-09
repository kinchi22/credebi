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

type PlacedAccount = {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly groupId: AccountGroupId | null;
};

type PlacedGroup = {
  readonly id: AccountGroupId;
  readonly accountType: AccountType;
};

export type OutlineNode<Account extends PlacedAccount, Group extends PlacedGroup> =
  | { readonly kind: 'account'; readonly account: Account }
  | { readonly kind: 'group'; readonly group: Group; readonly accounts: readonly Account[] };

export type ChartNodeOutput = OutlineNode<AccountOutput, AccountGroupOutput>;

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

export function nodesOfType<Account extends PlacedAccount, Group extends PlacedGroup>(
  chart: readonly OutlineNode<Account, Group>[],
  accountType: AccountType,
): OutlineNode<Account, Group>[] {
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

export const chartNodeRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('account'), id: accountIdSchema }),
  z.object({ kind: z.literal('group'), id: accountGroupIdSchema }),
]);

export type ChartNodeRef = z.infer<typeof chartNodeRefSchema>;

export const chartPlaceSchema = z.object({
  accountType: accountTypeSchema,
  groupId: accountGroupIdSchema.nullable(),
});

export type ChartPlace = z.infer<typeof chartPlaceSchema>;

export const moveChartNodeInputSchema = chartPlaceSchema.extend({
  node: chartNodeRefSchema,
  index: z.number().int().nonnegative(),
});

export type MoveChartNodeInput = z.infer<typeof moveChartNodeInputSchema>;

export const idOfNode = (node: OutlineNode<PlacedAccount, PlacedGroup>): string =>
  node.kind === 'account' ? node.account.id : node.group.id;

export function listIn<Account extends PlacedAccount, Group extends PlacedGroup>(
  chart: readonly OutlineNode<Account, Group>[],
  { accountType, groupId }: ChartPlace,
): OutlineNode<Account, Group>[] {
  const nodes = nodesOfType(chart, accountType);
  if (groupId === null) {
    return nodes;
  }
  return nodes.flatMap((node) =>
    node.kind === 'group' && node.group.id === groupId
      ? node.accounts.map((account) => ({ kind: 'account' as const, account }))
      : [],
  );
}

export function moveBefore(
  chart: readonly ChartNodeOutput[],
  node: ChartNodeRef,
  to: ChartPlace,
  before: string | null,
): MoveChartNodeInput {
  const others = listIn(chart, to)
    .map(idOfNode)
    .filter((id) => id !== node.id);
  const index = others.findIndex((id) => id === before);
  return { node, ...to, index: index === -1 ? others.length : index };
}

export type ChartDropTarget =
  | {
      readonly on: 'row';
      readonly place: ChartPlace;
      readonly node: ChartNodeRef;
      readonly next: string | null;
    }
  | { readonly on: 'heading'; readonly accountType: AccountType; readonly groupId: AccountGroupId }
  | { readonly on: 'end'; readonly place: ChartPlace };

export type ChartDrop = {
  readonly target: ChartDropTarget;
  readonly span: { readonly top: number; readonly height: number };
  readonly pointer: number;
};

export type ChartLanding = { readonly place: ChartPlace; readonly before: string | null };

const typeOfNode = (node: ChartNodeOutput): AccountType =>
  node.kind === 'group' ? node.group.accountType : node.account.accountType;

function aimedAt({ target, span, pointer }: ChartDrop): ChartLanding {
  if (target.on === 'end') {
    return { place: target.place, before: null };
  }
  if (target.on === 'row') {
    const lowerHalf = pointer > span.top + span.height / 2;
    return { place: target.place, before: lowerHalf ? target.next : target.node.id };
  }
  const { accountType, groupId } = target;
  return pointer < span.top + span.height / 4
    ? { place: { accountType, groupId: null }, before: groupId }
    : { place: { accountType, groupId }, before: null };
}

export function landingOf(
  chart: readonly ChartNodeOutput[],
  node: ChartNodeRef,
  drop: ChartDrop,
): ChartLanding | undefined {
  const taken = found(chart, node);
  const landing = aimedAt(drop);
  const { place } = landing;
  if (
    taken === undefined ||
    (taken.kind === 'group' && place.groupId !== null) ||
    typeOfNode(taken) !== place.accountType ||
    landing.before === node.id
  ) {
    return undefined;
  }
  const { index } = moveBefore(chart, node, place, landing.before);
  const stays =
    listIn(chart, place).findIndex((other) => idOfNode(other) === node.id) === index;
  return stays ? undefined : landing;
}

export function droppedMove(
  chart: readonly ChartNodeOutput[],
  node: ChartNodeRef,
  drop: ChartDrop,
): MoveChartNodeInput | undefined {
  const landing = landingOf(chart, node, drop);
  return landing === undefined ? undefined : moveBefore(chart, node, landing.place, landing.before);
}

function found<Account extends PlacedAccount, Group extends PlacedGroup>(
  chart: readonly OutlineNode<Account, Group>[],
  { kind, id }: ChartNodeRef,
): OutlineNode<Account, Group> | undefined {
  const candidates =
    kind === 'group'
      ? chart
      : chart.flatMap((node) =>
          node.kind === 'group'
            ? node.accounts.map((account) => ({ kind: 'account' as const, account }))
            : [node],
        );
  return candidates.find((node) => node.kind === kind && idOfNode(node) === id);
}

function without<Account extends PlacedAccount, Group extends PlacedGroup>(
  chart: readonly OutlineNode<Account, Group>[],
  id: string,
): OutlineNode<Account, Group>[] {
  return chart.flatMap((node): OutlineNode<Account, Group>[] => {
    if (idOfNode(node) === id) {
      return [];
    }
    return node.kind === 'group'
      ? [{ ...node, accounts: node.accounts.filter((account) => account.id !== id) }]
      : [node];
  });
}

const insertedAt = <Item>(items: readonly Item[], index: number, item: Item): Item[] => [
  ...items.slice(0, index),
  item,
  ...items.slice(index),
];

function withList<Account extends PlacedAccount, Group extends PlacedGroup>(
  chart: readonly OutlineNode<Account, Group>[],
  accountType: AccountType,
  change: (nodes: OutlineNode<Account, Group>[]) => OutlineNode<Account, Group>[],
): OutlineNode<Account, Group>[] {
  return accountTypeSchema.options.flatMap((type) =>
    type === accountType ? change(nodesOfType(chart, type)) : nodesOfType(chart, type),
  );
}

export function movedInChart<Account extends PlacedAccount, Group extends PlacedGroup>(
  chart: readonly OutlineNode<Account, Group>[],
  move: MoveChartNodeInput,
): OutlineNode<Account, Group>[] {
  const taken = found(chart, move.node);
  const { groupId } = move;
  if (taken === undefined || (taken.kind === 'group' && groupId !== null)) {
    return [...chart];
  }

  const rest = without(chart, move.node.id);
  if (taken.kind === 'group') {
    return withList(rest, move.accountType, (nodes) => insertedAt(nodes, move.index, taken));
  }

  const account: Account = { ...taken.account, groupId };
  if (groupId === null) {
    return withList(rest, move.accountType, (nodes) =>
      insertedAt(nodes, move.index, { kind: 'account', account }),
    );
  }
  return withList(rest, move.accountType, (nodes) =>
    nodes.map((node) =>
      node.kind === 'group' && node.group.id === groupId
        ? { ...node, accounts: insertedAt(node.accounts, move.index, account) }
        : node,
    ),
  );
}

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
