# ADR-0033: Report the Change score beside the floor

**Status:** Accepted
**Date:** 2026-11-20

## Problem

The mutation score is the coverage floor (ADR-0004), and it is one number over
the whole surface, with a break threshold of 90. At its last measurement, 98.75
over 2,877 mutants, a pull request can add a module whose tests kill nothing and
stay green: #482 found `i18n-request.ts` at 15.79 while the whole surface read
98.20. A weak test in a small change cannot move the number the floor reads, so
nothing told the owner, reviewing a pull request, how well the code it changes
is tested.

Separately, Production could be released from a commit whose `Mutation testing`
run failed. The rulesets require the check on a pull request, but the release
sequence on a push to `main` waited for `Gates` and `Integration` only.

## Decision

Every pull request's `Mutation testing` job reports its Change score
(`docs/GLOSSARY.md`) beside the whole-surface score, in the job summary and in
the `mutation-report` artifact. The floor is unchanged: thresholds and `mutate`
in `stryker.config.ts` stay as ADR-0004 decides them, and ADR-0004 is not
amended.

A Changed mutant is a mutant whose location overlaps a line the pull request
adds or modifies against its merge base, or any mutant of a file the pull
request creates. Overlap is by line: a mutant spans its start line through its
end line, its end being exclusive, so an end at the first column of a line does
not reach that line. A hunk that only deletes adds no line. A file only renamed
or moved is not a change, and a deleted file has none. Only files the `mutate`
patterns measure contribute.

The score counts the way Stryker counts: killed and timeout over killed,
timeout, survived and no coverage. Compile and runtime errors and ignored
mutants are counted apart, outside the denominator. No Changed mutant is not
applicable, never 100. A Stryker JSON report that is missing, unparseable, not
a report, or holding a mutant that never ran is incomplete, never a score.

The report is advisory. The target of 95 is shown beside the Change score and
fails nothing; the reporter failing to run fails the step, because a report
that silently stops being produced is the failure this exists to prevent. The
step runs after Stryker under `if: always()` inside the existing job, so the
required check keeps its name in both rulesets.

One pure function, `buildChangeReport` in `tools/change-score.ts`, decides the
report from the Stryker JSON text, the raw `git diff -U0 -M` text against the
merge base and the `mutate` patterns, and `renderChangeReport` turns it into
Markdown. The command in the same file runs git, reads and writes the files and
appends to the job summary, and is not tested on its own. Later work on the
Change score builds on that function rather than beside it.

On a push to `main`, the job keeps the Stryker JSON report alone as the
`mutation-json` artifact for 90 days, as a baseline to compare pull requests
against.

Production waits for mutation: the release sequence on a push to `main` needs
`Mutation testing` to have succeeded on the same commit, and a skipped,
cancelled or missing result holds the release as a failure does.

## Consequences

A changed line and the behaviour a mutant affects are not the same thing. A
Changed mutant may change behaviour reached only from unchanged code, and a
changed line may weaken the tests of a mutant elsewhere, which this report does
not see. It measures the mutants the diff touches, not the behaviour the change
affects.

A small change gives a score that one mutant swings. The percentage is shown
with its raw counts, and nothing acts on it automatically.

The checkout of the `Mutation testing` job fetches the full history, which
costs seconds on a job that runs about eight minutes. Release waits that much
longer on a push to `main`.

Advisory means a pull request can merge with a low Change score. Blocking on it
is later work, after the report has run on real pull requests and the target
has been calibrated against them.

## Rejected alternatives

**Raising the global break threshold.** The whole surface is at 98.75, and a
new file's zero is diluted by thousands of killed mutants however high the
threshold sits. Raising it until a small module moves it would fail unrelated
pull requests on old survivors.

**Scoring changed files whole.** A one-line edit to a large file would drag in
every old survivor of that file, and the owner would read the file's history as
the pull request's quality. Files the pull request creates are counted whole
because every line of them is new.

**Blocking on the Change score now.** Neither the target nor the treatment of
small samples has been measured against real pull requests; a blocking check
set before that would be lowered the first time it was wrong.

**Running Stryker on the changed files only.** Incremental runs change what is
measured and how the whole-surface score is produced, and the floor ADR-0004
decides would stop being measured on every pull request.

**A separate job for the report.** A new job would need the report handed over
as an artifact and a new name in the rulesets; a step inside the existing job
keeps the required check unchanged.
