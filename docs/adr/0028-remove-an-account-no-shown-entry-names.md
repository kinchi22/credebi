# ADR-0028: Remove an Account no shown Entry names

**Status:** Deferred
**Date:** 2026-10-13
**Trigger:** Feature #364, removing an Account once only deleted Entries name it.

## Problem

ADR-0026 removes an Account only while no Entry line names it, a hidden Reversal
pair included, because ADR-0016 keeps that pair forever and its lines must still
resolve to an Account. It accepted the cost: an Account named once can never be
removed, even after every Entry naming it was deleted.

That cost lands on the commonest mistake. A User adds an Account by accident,
posts an Entry against it, deletes the Entry, and is then refused removal for an
Entry they cannot see. Their only way out is an end day, and the Account stays
in their Chart of accounts for good.

The refusal guards the audit trail, not the User: a hidden pair needs the
Account's row, not its place in the chart.

## Decision

When the trigger holds, this replaces the Removal decision of ADR-0026, its
consequence that a once-named Account can never be removed, and its rejected
alternative "Remove an Account while only hidden Entries name it". The rest of
ADR-0026 stands. None of this is in force before then.

- **Rule.** An Account is removable while no shown Entry names it. A Reversal
  and the Entry it reverses do not count, from a delete or a Correction alike,
  as they already do not count for an Active period change. A shown Entry
  naming it is still refused with `IN_USE`.
- **Nothing names it.** Its row is deleted, as under ADR-0026.
- **Only hidden pairs name it.** Its row stays, so `entry_lines.account_id`
  keeps its foreign key, and it is marked removed: `accounts.removed_at`, the
  moment of removal. Its Account group and position are cleared, so it sits
  nowhere in the chart. Removal is final; there is no restore.
- **Reads.** The chart read omits removed Accounts, so every place that lists or
  checks Accounts -- Settings, the entry form, Suggested accounts, Entry search
  -- drops them with no rule of its own.
- **Names.** An Account's name is unique among the User's Accounts not removed,
  so a removed Account's name is free for a new one. A shown Entry names only
  Accounts not removed, so a name still identifies its Account wherever an
  Entry is shown.
- **Writing an Entry.** The write refuses, in its transaction, a line naming a
  removed Account, answering as for an Account not in the chart, so a removal
  racing a post cannot leave a shown Entry naming one.
- **Migration, in one release** (ADR-0024). It adds the nullable `removed_at`
  and makes the name index partial. Current Production ignores the column and
  marks nothing, so it stays correct until Promotion.

## Consequences

Two Accounts of one User may share a name, one of them removed. Only the hidden
audit trail can see both, and it tells them apart by id.

A removed Account is a row every Account read must skip, as a Reversal pair is
for every Entry read.

Removal has two outcomes the User cannot tell apart, and the use case must ask
whether a shown Entry, a hidden one, or none names the Account.

The audit trail now records when an Account left the chart, which ADR-0026's
deletion would not have.

## Rejected alternatives

**Keep ADR-0026's rule.** It protects nothing the User can see, and leaves a
mistaken Account in the chart for good, which is what #364 reports.

**Mark every removal, never delete a row.** One path instead of two, at the cost
of keeping rows nothing will ever read; an Account no Entry ever named has no
history to keep.

**Delete the row and the hidden pairs naming it.** It erases what ADR-0016
keeps the pairs for.

**Repoint the hidden pairs to a placeholder Account.** The audit trail would no
longer say which Account the deleted Entry was posted against.

**An archived flag the User sets.** ADR-0015's archive, which ADR-0026 rejected:
it hides an Account rather than removing it, and an end day already retires one.
