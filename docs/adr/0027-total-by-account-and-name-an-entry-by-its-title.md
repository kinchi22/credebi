# ADR-0027: Total by Account, and name an Entry by its Title

**Status:** Accepted
**Date:** 2026-10-11

## Problem

Feature #253 asks for a classification finer than an Account, entered freely at
posting time, e.g. `Food` classified as `Dining out`, so the Chart of accounts
(ADR-0026) can stay shallow. It also asks that the classification be usable for
totals.

An Entry has two or more Entry lines, each naming its own Account, so a
classification meant for totals belongs on a line. A salary Entry shows why:
one credit to Salary, debits to Income tax, Pension, Resident tax, Employment
insurance and Bank. Totalling each deduction for a year needs each deduction
told apart, line by line. The same need can be met either by a line-level
classification beside the Account or by an Account per deduction.

## Decision

- **What is totalled is an Account.** A distinction that needs a total is an
  Account of its own, gathered under an Account group when several belong
  together, e.g. Deductions > Income tax, Pension, Resident tax, Employment
  insurance. Nothing finer than an Account is ever totalled.
- **An Entry line carries no classification.** A line is an Account, a Side and
  an amount (ADR-0010), and stays that.
- **An Entry has an optional Title.** One per Entry: free text naming what the
  Entry is, such as Salary or Starbucks, trimmed, at most 40 characters, matched
  ignoring case. It is stored on the Entry as typed and is not an entity, so it
  has no lifecycle of its own: a Title is renamed only by correcting the Entries
  that carry it (ADR-0016), and the Titles offered are those the User's shown
  Entries carry.
- **The memo becomes optional.** It stays free-form context for a person, at
  most 200 characters, and is searched by substring; a Title is searched whole.
- **A Title serves entry and search, not totals.** It is offered as the User
  types, is an Entry search criterion, and keys reusing an earlier Entry's lines.

## Consequences

- A User who wants a finer total adds Accounts, so the Chart of accounts grows
  where the User needs detail. Account groups keep it readable, and an Account
  retired by its end day leaves the entry form.
- There is one way to express a distinction that is totalled, so a future report
  totals Accounts and Account groups and never reconciles them with a second
  scheme.
- A Title cannot be renamed across past Entries in one step. A typo stays offered
  until the Entries carrying it are corrected.
- A Title says nothing per line, so an Entry mixing several purposes is described
  by its Accounts, and its memo if the User wants words.

## Rejected alternatives

- **A classification on each Entry line.** It duplicates the Account's job: the
  same deduction could be booked as a Taxes Account classified Income tax or as
  an Income tax Account, and totals would split between the two. It also adds a
  field to every line of the entry form.
- **A classification as an entity, scoped to an Account.** It allows renaming
  and merging across past Entries, but needs its own management screen and
  lifecycle, which is only worth paying for when the classification is totalled.
- **Free-text tags, several per Entry.** Totals over overlapping tags count an
  amount more than once, and nothing here totals by them.
