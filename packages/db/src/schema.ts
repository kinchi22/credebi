import {
  type AnyPgColumn,
  bigint,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const identities = pgTable(
  'identities',
  {
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerSubject] }),
    index('identities_user_id_idx').on(table.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey(),
    entryDate: date('entry_date').notNull(),
    memo: text('memo').notNull(),
    title: text('title').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reversesEntryId: uuid('reverses_entry_id')
      .unique()
      .references((): AnyPgColumn => entries.id),
  },
  (table) => [index('entries_user_id_idx').on(table.userId)],
);

export const accountGroups = pgTable(
  'account_groups',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountType: text('account_type').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('account_groups_id_user_id_account_type_unique').on(
      table.id,
      table.userId,
      table.accountType,
    ),
    uniqueIndex('account_groups_user_id_account_type_name_idx').on(
      table.userId,
      table.accountType,
      sql`lower(${table.name})`,
    ),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountType: text('account_type').notNull(),
    groupId: uuid('group_id'),
    name: text('name').notNull(),
    description: text('description'),
    position: integer('position'),
    activeFrom: date('active_from').notNull(),
    activeUntil: date('active_until'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'accounts_group_fk',
      columns: [table.groupId, table.userId, table.accountType],
      foreignColumns: [accountGroups.id, accountGroups.userId, accountGroups.accountType],
    }),
    uniqueIndex('accounts_user_id_name_idx')
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.removedAt} is null`),
    index('accounts_group_id_idx').on(table.groupId),
  ],
);

export const entryLines = pgTable(
  'entry_lines',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    lineNumber: smallint('line_number').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    side: text('side').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.lineNumber] }),
    index('entry_lines_account_id_idx').on(table.accountId),
  ],
);

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  entryFormMode: text('entry_form_mode').notNull(),
  language: text('language').notNull().default('en'),
});

export const userChartViews = pgTable(
  'user_chart_views',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chartId: text('chart_id').notNull(),
    shownSeriesIds: text('shown_series_ids').array().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.chartId] })],
);

export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    clientName: text('client_name').notNull(),
    redirectUris: text('redirect_uris').array().notNull(),
    approvedRedirectUri: text('approved_redirect_uri').notNull(),
    scopes: text('scopes').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('connections_user_id_idx').on(table.userId)],
);

export const authorizationCodes = pgTable(
  'authorization_codes',
  {
    codeHash: text('code_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    clientName: text('client_name').notNull(),
    redirectUris: text('redirect_uris').array().notNull(),
    scopes: text('scopes').array().notNull(),
    codeChallenge: text('code_challenge').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    resource: text('resource').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('authorization_codes_user_id_idx').on(table.userId)],
);

export const accessTokens = pgTable(
  'access_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('access_tokens_connection_id_idx').on(table.connectionId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    replacedByHash: text('replaced_by_hash'),
  },
  (table) => [index('refresh_tokens_connection_id_idx').on(table.connectionId)],
);

export const requestKeys = pgTable(
  'request_keys',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id),
    connectionId: uuid('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index('request_keys_entry_id_idx').on(table.entryId),
    index('request_keys_connection_id_idx').on(table.connectionId),
  ],
);

export const schema = {
  users,
  identities,
  sessions,
  entries,
  accountGroups,
  accounts,
  entryLines,
  userSettings,
  userChartViews,
  connections,
  authorizationCodes,
  accessTokens,
  refreshTokens,
  requestKeys,
} as const;

export type Schema = typeof schema;
