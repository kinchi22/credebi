# ADR-0026: Keep a chart of accounts per User

**Status:** Deferred
**Date:** 2026-10-09
**Trigger:** Feature #252, the owner managing their own Accounts in Settings.

## Problem

Every Entry line names an Account (ADR-0010), and the Chart of accounts is five
codes compiled into `domain/`: `cash`, `payable`, `capital`, `sales`, `expense`.
A User cannot add, rename, group or retire one.

ADR-0015 decided to move accounts into data, but it was written before there
were Users (ADR-0021) and before an Entry could be corrected (ADR-0016). It
describes one shared table, a `code` the owner types, and an archived flag in
place of removal. Feature #252 asks for something different: each User's own
Accounts, gathered into groups, each usable over a span of days, and removable
while nothing names them.

## Decision

When the trigger holds, accounts become their own feature,
`packages/core/src/accounts/` with the layers `AGENTS.md` names, and
`packages/contracts/src/accounts.ts`. None of this is in force before then.

- **One chart per User.** An `accounts` table keyed by `AccountId` (uuid v7),
  each row owned by one User; no User reads or names another's Account. There is
  no `code`: an Account has a name and an optional description, and its id is
  its only key.
- **Two kinds of node, fixed at creation.** An Account is posted to and never
  has children. An Account group holds Accounts and nothing else, sits directly
  under an Account type, and is never posted to. An Account sits directly under
  its Account type or inside one Account group of that type. No group holds a
  group, so the tree is at most two deep below an Account type.
- **Account type never changes.** It is the fixed vocabulary of double-entry
  bookkeeping and stays a domain constant. An Account may move between groups
  of its type, or out of them, but never to another type.
- **The User orders the chart.** Within an Account type, its groups and
  ungrouped Accounts form one ordered list; within a group, its Accounts form
  another. A new node joins the end of its list. Every place that lists Accounts
  follows this order.
- **Names.** Trimmed, 1 to 40 characters, compared without case. An Account's
  name is unique among the User's Accounts, so an Account name alone identifies
  it wherever an Entry is shown. A group's name is unique among the groups of its
  Account type. A description is optional, up to 200 characters.
- **Active period.** An Account has a start day and an optional end day, both
  inclusive. An end day before the start day is refused; one equal to it makes
  a period of one day. An Entry line names an Account only on a day its Active period
  holds, checked when an Entry is posted, a Correction's replacement included.
  A change to an Active period that would leave a shown Entry outside it is
  refused; a Reversal and the Entry it reverses do not count, since together they
  sum to nothing.
- **Removal.** An Account is removed only while no Entry line names it, a hidden
  Reversal pair included, because ADR-0016 keeps that pair forever and it must
  still resolve. An Account still named is retired by giving it an end day. A
  group is removed only while it is empty. There is no archived flag.
- **Seeding.** A User starts with five Accounts, Cash, Accounts payable,
  Capital, Sales and Expenses, one directly under each Account type, starting on
  the day the User was created. The names are stored as data in English and are
  the User's from then on; the catalogue's `accounts` copy is deleted.
- **Migration, in two releases** (ADR-0024). The first creates `accounts`, adds
  `entry_lines.account_id` referencing it, seeds the five Accounts for every
  existing User, the Smoke User included, and fills `account_id` from each
  line's code. The code column stays, because Current Production still reads
  it. A later release drops it. `tools/seed-smoke-user.ts` seeds the Smoke
  User's Accounts too.
- **Validation moves out of the pure domain.** The chart constant in `domain/`
  is deleted. Whether a line names an Account of the User's chart, active on the
  Entry's day, is decided in the use case from a repository read, and the rule
  itself stays a pure function over the Accounts read.

## Consequences

An existing User's Entry dated before the day the User was created falls outside
the seeded Accounts' Active period. The migration accepts that rather than
deriving a start day from the data, because the only such Users are the owner,
whose Production data is disposable, and the Smoke User, which only reads. A
change to such an Account's Active period is refused until the start day is moved
earlier.

A User who signs up and then posts a back-dated Entry finds no Account offered
for that day until they move a start day earlier in Settings.

An Account that was named once can never be removed, even after every Entry
naming it was deleted, because the deleted Entries are still in the books. The
refusal has to say so, since the User cannot see them.

Reordering is a write per drag, and the order is state every list must read.
Drag is the only way to reorder, so ordering is not reachable from a keyboard;
moving an Account between groups is, through its edit dialog.

Between the first release's migration and its Promotion, Current Production
still writes Entry lines with no `account_id` and creates Users with no Accounts.
After Promotion, such a User's Entries fail to read and their posts are refused.
This is accepted with no healing and no backfill, because the owner is the only
User and does not write during that window.

The domain loses a compile-time set of Accounts, so posting an Entry needs the
repository, which is the testability ADR-0015 already accepted losing.

## Rejected alternatives

**ADR-0015 as written.** One shared chart predates Users; an owner-typed code is
a second name nobody asked for; and archive-only leaves no way to undo a
mistaken Account, which #252 asks for.

**Remove an Account while only hidden Entries name it.** The Reversal pairs
ADR-0016 keeps would name an Account that no longer exists, and the audit trail
would no longer resolve.

**Any Account can have children, and be posted to.** An Account posted to and
then given children holds a balance of its own beside theirs, which no report can
place. Fixing the kind at creation removes the case.

**Groups within groups.** Arbitrary depth makes every list, picker and drop
target a tree; two levels below an Account type cover the books #252 describes.

**Active period gates only what the form offers.** A client other than the form,
or a Correction, could post outside it, so the rule would hold only by
convention.

**Seed start days from each User's earliest Entry.** Exact, but a data-dependent
migration for two Users whose data is disposable or read-only.

**Alphabetical order.** Simpler, with no write per drag, and it puts the
Accounts a User uses most wherever their names happen to sort.
