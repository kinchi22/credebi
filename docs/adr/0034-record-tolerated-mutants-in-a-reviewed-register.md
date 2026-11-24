# ADR-0034: Record tolerated mutants in a reviewed register

**Status:** Accepted
**Date:** 2026-11-25

## Problem

Some survived mutants are not worth killing. A mutant may be equivalent, so no
test can tell it apart from the original, or killing it may take a brittle
assertion on something no behaviour depends on, like the two message survivors
of the health domain (ADR-0004). Nothing records which survivors were judged
that way, why, or until when, so the Change score (ADR-0033) lists a reviewed
survivor the same way as a missing assertion. ADR-0025 bans comments in code,
Stryker's disable comments included, so the judgement cannot sit beside the
mutant.

## Decision

A register of Tolerated mutants (`docs/GLOSSARY.md`) is the JSON file
`tolerated-mutants.json` at the repository root, beside the Stryker
configuration. It is owned in `.github/CODEOWNERS` and listed in the Human
review surface table, so no entry is added, changed or removed without the
owner's review. That review is the approval; the entry carries no approver.

Every entry has exactly these fields, all required: `file`, `mutator`,
`original` (the source text at the mutant's location, non-empty), `replacement`, `reason`
(non-empty), `recorded` and `revisitBy`, both `YYYY-MM-DD`. `revisitBy` is on or
after `recorded` and at most six calendar months after it, so no judgement
outlives the code it was written against.

Identity is position-free. A mutant matches an entry when the file, mutator and
replacement are equal and the source text at the mutant's location, read from
the file source the Stryker JSON report carries, equals `original`. An entry
still matches after unrelated lines move. The match is the one exported function
`matchesEntry` in `tools/change-score.ts`, so any later check that compares
mutants across runs decides identity the same way.

Only a Survived mutant is tolerated, never a no-coverage one: that would excuse
code no test reaches, which is what an exclusion in the Stryker configuration
does, and exclusions are reviewed there. An entry tolerates a mutant when it
matches exactly one mutant of the report and that mutant is Survived.

A tolerated mutant still counts as survived in the Change score, the File score
and the whole-surface score: the register never raises a number. The report
lists it apart from the untriaged ones, the survived and no-coverage mutants no
entry tolerates, with its reason and revisit day. The small-sample view, below
20 scored Changed mutants, counts untriaged survived and no-coverage mutants
against its target of zero, in place of the "zero survived or no-coverage
mutants" that ADR-0033 states.

An invalid register fails the step. Missing, not JSON, not an array, an entry
off the shape above, or two entries matching one mutant: `buildChangeReport`
returns an `invalid` report with the reason, and the command exits non-zero, as
it does for a crash. A low Change score still never fails it. `buildChangeReport`
takes the register's raw text, or nothing when the file is absent, and
`pnpm test:mutation:changed`, with or without `--file`, applies the register the
same way. A Stryker report whose mutant has no replacement, or whose file has no
source, is incomplete, because identity cannot be read from it.

The run day is a UTC date the command supplies to `buildChangeReport`. An entry
is live on its `revisitBy` day and expired the day after. An expired entry
tolerates nothing, so its mutant is untriaged again. A live entry that tolerates
nothing is stale, for one of four reasons: its file is outside the `mutate`
patterns, no mutant matches it, it matches more than one mutant of its file, or
it matches a mutant that is not Survived. An expired entry is reported as
expired and never also as stale.

Every complete report carries a register summary across the whole surface, not
only the changed files: the count of live entries, which tolerate a mutant, and
each stale and expired entry with why. A stale or expired entry is advisory and
never fails the step; an invalid register still does. A narrowed local run,
`pnpm test:mutation:changed` with or without `--file`, judges only the entries
whose file its Stryker report holds. The others are counted as unjudged and are
never stale or expired.

ADR-0004 and ADR-0033 are not amended.

## Consequences

The owner reviews a data file instead of reading comments, and every judgement
is in version control with its reason. An entry is tied to the exact source text
of its mutant, so editing that text makes the entry match nothing and the mutant
untriaged again, which is the intended prompt to look again. Two textually
identical mutants in one file cannot be tolerated individually, because an entry
matching both tolerates neither.

## Rejected alternatives

- **Stryker disable comments.** Banned by ADR-0025, and they would sit in files
  no one owns for review.
- **Matching by position.** Any edit above the mutant would break the entry, so
  the register would rot on unrelated changes.
- **An exclusion in `stryker.config.ts`.** It removes the mutant from the floor
  too, which lowers what the floor measures instead of recording a judgement
  about one mutant.
- **Tolerating no-coverage mutants.** It would let the register excuse code no
  test reaches.
