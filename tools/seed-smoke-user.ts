import { createHash, randomBytes } from 'node:crypto';

const SMOKE_USER_ID = '01995d40-0000-7000-8000-000000000001';
const SMOKE_ENTRY_ID = '01995d40-0000-7000-8000-000000000002';

const SMOKE_ACCOUNTS = [
  { id: '01995d40-0000-7000-8000-000000000011', accountType: 'asset', name: 'Cash' },
  { id: '01995d40-0000-7000-8000-000000000012', accountType: 'liability', name: 'Accounts payable' },
  { id: '01995d40-0000-7000-8000-000000000013', accountType: 'equity', name: 'Capital' },
  { id: '01995d40-0000-7000-8000-000000000014', accountType: 'revenue', name: 'Sales' },
  { id: '01995d40-0000-7000-8000-000000000015', accountType: 'expense', name: 'Expenses' },
] as const;

const [CASH, , , , EXPENSES] = SMOKE_ACCOUNTS;

const fixedAccountIds = SMOKE_ACCOUNTS.map(({ id }) => `'${id}'`).join(', ');

const accountRows = SMOKE_ACCOUNTS.map(
  ({ id, accountType, name }) => `  ('${id}', '${accountType}', '${name}')`,
).join(',\n');

const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');

const expiresAt = new Date();
expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
const expiresOn = expiresAt.toISOString().slice(0, 10);

process.stdout.write(`begin;

insert into users (id, email, name, created_at)
values ('${SMOKE_USER_ID}', 'smoke@test.invalid', 'Smoke User', now())
on conflict (id) do nothing;

insert into entries (id, entry_date, memo, created_at, user_id)
values ('${SMOKE_ENTRY_ID}', '2026-09-18', 'Smoke run', now(), '${SMOKE_USER_ID}')
on conflict (id) do nothing;

delete from entry_lines
where entry_id = '${SMOKE_ENTRY_ID}';

delete from accounts
where user_id = '${SMOKE_USER_ID}'
  and id not in (${fixedAccountIds})
  and not exists (select 1 from entry_lines where entry_lines.account_id = accounts.id);

insert into accounts (id, user_id, account_type, name, position, active_from)
select seed.id::uuid, users.id, seed.account_type, seed.name, 0, (users.created_at at time zone 'UTC')::date
from users
cross join (values
${accountRows}
) as seed (id, account_type, name)
where users.id = '${SMOKE_USER_ID}'
on conflict (id) do nothing;

insert into entry_lines (entry_id, line_number, account_id, side, amount)
values
  ('${SMOKE_ENTRY_ID}', 1, '${EXPENSES.id}', 'debit', 100),
  ('${SMOKE_ENTRY_ID}', 2, '${CASH.id}', 'credit', 100);

delete from sessions where user_id = '${SMOKE_USER_ID}';

insert into sessions (token_hash, user_id, expires_at)
values ('${tokenHash}', '${SMOKE_USER_ID}', '${expiresAt.toISOString()}');

commit;
`);

process.stderr.write(
  `SMOKE_SESSION_TOKEN=${token}\n` +
    `SMOKE_SESSION_EXPIRES_ON=${expiresOn}\n` +
    'Run the SQL on Production first, then:\n' +
    '  gh secret set SMOKE_SESSION_TOKEN\n' +
    `  gh variable set SMOKE_SESSION_EXPIRES_ON --body ${expiresOn}\n`,
);
