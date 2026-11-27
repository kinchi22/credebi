# ADR-0033: Report the Change score beside the floor

**Status:** Accepted
**Date:** 2026-11-20
**Amended:** 2026-11-21, PR #760, amended rather than superseded by the owner's choice
**Amended:** 2026-11-24, PR #888, amended rather than superseded by the owner's choice
**Amended:** 2026-11-24, PR #889, amended rather than superseded by the owner's choice
**Amended:** 2026-11-27, PR #929, amended rather than superseded by the owner's choice

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

Every file the pull request touches is classified, so nothing unmeasured reads
as tested. A file with a Changed mutant is measured: created, modified, or
renamed with edits, whose edited lines alone count. Every other file is listed
apart, with why it was not measured: deleted; excluded, outside the `mutate`
patterns; non-mutatable, inside them with no mutant in the report; moved,
renamed with no edited line; or touched on lines that hold no mutant.

The score counts the way Stryker counts: killed and timeout over killed,
timeout, survived and no coverage. Compile and runtime errors and ignored
mutants are counted apart, outside the denominator. No Changed mutant is not
applicable, never 100. A Stryker JSON report that is missing, unparseable, not
a report, or holding a mutant that never ran is incomplete, never a score.
Stryker writes its JSON report only once every mutant has run, so a run cut
short leaves no report, and a missing report is how a partial run shows.

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

A person can read the same Change score before a pull request exists.
`pnpm test:mutation:changed` takes the diff against a base, by default the merge
base with `origin/main`, up to the working tree, so committed, staged and
unstaged edits count and an untracked file counts as created. It hands Stryker
every measured file whole, never a line range, because Stryker keeps only a
mutant inside a range and a Changed mutant need only overlap a changed line;
`buildChangeReport` then keeps the Changed mutants. With `--file`, it measures
the named files whole and reports their File score (`docs/GLOSSARY.md`) instead,
for a change to tests alone; a named file outside the `mutate` patterns, or one
that does not exist, stops the command without a run. A file moved in the working
tree without `git mv` is found as moved by diffing against a temporary index,
never the person's. A file only moved is not handed to Stryker, and a change
with no measured file is not applicable without starting Stryker. The local run writes beside the CI report, never over
it, reports no whole-surface score, which a narrowed run cannot know, and turns
off the break threshold, so it exits non-zero only when the run is incomplete
or fails, never on a score.

On a push to `main`, the job keeps the Stryker JSON report alone as the
`mutation-json` artifact for 90 days, as a baseline to compare pull requests
against.

Every pull request's change report also compares its mutant outcomes with a
Baseline (`docs/GLOSSARY.md`), which finds what a change that touches no source
line cannot show: a test weakened or deleted leaves no Changed mutant, yet
mutants its old tests killed now survive. The Baseline is the report kept for
the nearest first-parent ancestor of the pull request's merge base with
`origin/main` that has one, at most 50 commits back, whatever branch the pull
request targets. A Markdown-only commit on `main` skips mutation testing and so
has no report, which is why the nearest ancestor is taken and not the merge base
alone. `selectBaseline` decides it from plain values: the ancestors in order,
and the set of them with a usable report. It returns the commit and its distance,
too far back when none lies within 50 commits, or not found when the history
ends first. The command in the `Change score` step lists the ancestors, finds
the `main` push runs of CI with a non-expired `mutation-json` artifact through
`gh api`, downloads the chosen one and reads `mutate` at the Baseline commit.
Failing to reach the API fails the step; an artifact that is not there does not.
The `Mutation testing` job is granted the token permission to read Actions
artifacts for this.

A Regressed mutant (`docs/GLOSSARY.md`) is Killed or Timeout in the Baseline and
Survived or NoCoverage in the head, anywhere on the mutation surface, a pull
request that changes only tests included. Identity is `matchesEntry`'s rule
(ADR-0034), which is not amended: file, mutator, replacement and the source text
at the location. Mutants of one identity in one file are compared as a group by
count: where the head detects fewer of the group than the Baseline did, the
shortfall is flagged, never more than the group's undetected head mutants, and
every undetected head location of the group is listed, so a repeated literal
cannot hide a deleted test and no mutant is paired with the wrong one. A mutant
in only one side's groups is unmatched and never flagged, and so are Compile
error, Runtime error and Ignored mutants on either side. A tolerated Regressed
mutant is still flagged and counted, shown with its register entry, because the
register changes no count here as it changes no score.

The section is in every complete report, after the Change score and before the
register summary, and in the machine-readable report: regressed, none, or no
baseline with its reason. Not found, too far back, an expired or missing
artifact, an unparseable or incomplete Baseline report, and a Baseline measured
under different `mutate` patterns are each a no-baseline reason, never a failure
and never read as none regressed. An incomplete head report has no section. The
comparison is advisory: a Regressed mutant fails nothing, until it has run on
real pull requests, as the Change score has.

Production waits for mutation: the release sequence on a push to `main` needs
`Mutation testing` to have succeeded on the same commit, and a skipped,
cancelled or missing result holds the release as a failure does. #754 builds
this, in PR #758, through the release readiness decision in
`tools/production-release.ts`.

## Consequences

A changed line and the behaviour a mutant affects are not the same thing. A
Changed mutant may change behaviour reached only from unchanged code, and a
changed line may weaken the tests of a mutant elsewhere, which this report does
not see. It measures the mutants the diff touches, not the behaviour the change
affects.

A small change gives a score that one mutant swings. Below 20 scored Changed
mutants, those killed, timed out, survived or not covered, the report shows the
raw counts and the target of zero survived or no-coverage mutants in place of
the percentage, and nothing acts on either automatically. Errors and ignored
mutants do not count toward the 20, so a change whose Changed mutants are all
errors or ignored shows its counts, not N/A, which is kept for a change with no
Changed mutant at all.

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

**Running Stryker on the changed files only in CI.** Incremental runs change
what is measured and how the whole-surface score is produced, and the floor
ADR-0004 decides would stop being measured on every pull request. The local
command runs narrowed because it replaces no CI run.

**Line ranges for the local run.** Faster, but Stryker would drop a mutant that
overlaps a changed line without fitting inside it, such as the block of the
function the line sits in, so the local Change score would differ from CI's.

**The exact merge base only.** A Markdown-only commit skips mutation testing and
leaves no report, and a pull request branched there would have no comparison.

**The latest `main` run.** It compares a pull request with code it does not
contain, so every commit that landed since its merge base would read as a
difference of the pull request.

**Keeping Baselines for milestone branches.** Pushes to `milestone/**` keep no
report today, and keeping them would add a store to maintain. A pull request
into a milestone is compared with `main` at its merge base, and the
milestone-to-`main` pull request is the decisive comparison.

**A second Stryker run at the merge base.** It doubles the job of about eight
minutes to rebuild what `main` already kept.

**Stryker's incremental mode.** It decides what to rerun and not what to
report, and it keeps its state in a file that this comparison would then depend
on across runs.

**A separate job for the report.** A new job would need the report handed over
as an artifact and a new name in the rulesets; a step inside the existing job
keeps the required check unchanged.
