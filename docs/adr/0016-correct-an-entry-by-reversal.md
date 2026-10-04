# ADR-0016: Correct an entry by reversal

**Status:** Accepted
**Date:** 2026-09-16
**Adopted:** 2026-10-04, PR #PRNUM
**Trigger:** A criterion asks to change or remove an entry that is already
posted.

## Problem

Phase 1 creates entries and lists them. It offers no edit and no delete, so the
question of what happens to a mistake is open, and the answer shapes the schema:
an editable entry is a row with a history, an immutable one is a row plus a
second entry that cancels it.

Bookkeeping settled this long ago. A posted entry is not edited, because the
audit trail is the point of the ledger; it is cancelled by posting its reverse,
and the two stand side by side.

## Decision

When the trigger holds, correction is by reversal. None of it is in force before
then.

- Entries stay append-only. No update path, no delete path, no soft-delete flag.
- `entries` gains `reverses_entry_id`, nullable, referencing another entry. A
  reversal is an ordinary entry whose lines are the original's with `debit` and
  `credit` swapped, so the pair sums to nothing on every account.
- The use case builds the reversal from the original, so the caller supplies an
  `EntryId`, not a set of lines. The reversal takes the original's day, so a
  balance as of any day reads as though the original had never been posted.
- An entry may be reversed once, which a unique `reverses_entry_id` enforces,
  and a reversal is never reversed.
- A correction is a reversal and a new, correct entry, written together or not
  at all. A correction that would change nothing writes neither.
- Neither a reversal nor the entry it reverses is listed or found by a search.
  The UI calls a reversal "delete" and a correction "edit": the ledger keeps its
  audit trail, and the person sees the book they meant to keep.

## Consequences

A typo is permanent, together with the entry that cancels it, and hidden: the
audit trail is in the database, not on the screen. Showing it is a criterion of
its own.

Every correction adds two rows that every read must skip. Skipping is an anti
join on the indexed `reverses_entry_id`, and a replacement is not linked to the
entry it replaced, so no chain is ever walked: the current entry is the one
nothing reverses.

A correction writes two aggregates, which is the use case ADR-0011 waits for to
give the use case a transaction boundary of its own.

Nothing stops a hand-written reversal that does not match its original. The link
records intent; the balance is what makes the pair meaningful.

## Rejected alternatives

**Edit in place.** The cheapest interface, and it destroys the audit trail that
double-entry exists to keep. A ledger you can rewrite answers no question about
what happened.

**Soft delete with a flag.** It hides a mistake instead of explaining it, and
every report then has to remember the flag.

**Versioned entries, each edit a new revision.** It keeps history, and it invents
a second history mechanism beside the one bookkeeping already has, with reports
having to choose a revision.

**Decide it now and build it in Phase 1.** Nothing in Phase 1 has data worth
correcting: Production is disposable until the MVP (ADR-0009).
