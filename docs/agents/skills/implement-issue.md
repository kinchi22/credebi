# Driving a Task, or a Feature, to merged

This is the Driver's brief. `docs/agents/harnesses.md` defines the words used
here -- Driver, Implementer, Subagent, Skill, Agent worktree -- and maps each to
the mechanism your harness gives you.

You are the **Driver**. You build nothing yourself: each Task is built by a
fresh Implementer Subagent, and you review what it returns, so the review
always happens in a context separate from the one that wrote the code. The
owner's attention belongs to specs, migrations and `main`, and to nothing else.

`docs/agents/issue-tracker.md` holds the work items, the Status values, the base
branch for each Task and every `gh` command used below. Read it first.

## Input

- A **Task** or **Bug** number: run the loop once, for that issue. It must be in
  Ready with no open blocker; when it is not, say why and stop.
- A **Feature** number: run the loop over its frontier until a stop below.
- Nothing: list the Ready Tasks and ask which to take.

When a Feature's Task is claimed and the Feature is not yet In Progress, set it
In Progress.

## The loop

Take one Task at a time in the repository's working tree: two agents editing
the same tree collide whatever they are building. The gates do not force that on
their own. `pnpm test:integration` starts a throwaway Postgres of its own
through testcontainers, on a port it picks (`tools/integration/postgres-container.ts`);
the container in `docker-compose.yml` is the development database and no gate
touches it. `db:drift` and `db:check` read files and never connect. So a Task
can be built in parallel in an Agent worktree of its own, which costs a cold
`pnpm install` there.

One thing is genuinely shared. `playwright.config.ts` binds `127.0.0.1:3000` and
reuses a server already listening, so two local e2e runs at once silently test
each other's code. Whoever drives parallel Tasks coordinates that run, or keeps
it serial.

1. **Pick.** The first frontier Task, specs first. An empty frontier is a stop.
2. **Build.** Dispatch an Implementer Subagent with the prompt: "Implement
   issue #<n>. Follow `docs/agents/skills/implement-issue-implementer.md`." Pass
   nothing else; the issue is the brief. It returns a pull request number, or a
   question.
3. **Answer questions.** A question means the Task left a decision open. Put it
   to the owner, write the answer into the issue as a comment, and send the same
   Subagent on. When the answer changes the Task's scope, edit the issue body
   too.
4. **Review.** Check out the pull request's branch and invoke the `code-review`
   Skill with the pull request's base branch as the fixed point. The spec is the
   Task, and its Feature's body for context. Post the report on the pull request
   as a comment.
5. **Fix.** When either axis reports a hard violation, or a requirement missing
   or wrong, send the findings back to the same Subagent and review again.
   Judgement calls are the Subagent's to take or leave, with a reason in the
   pull request. After a second review that still fails, stop.
6. **Merge.** Wait for the required checks (`gh pr checks <pr> --watch
   --required`). Green, and with no owned path in the diff, merge it:
   `gh pr merge <pr> --squash --delete-branch`. An owned path, or a pull
   request into `main`, waits for the owner: that is a stop.
7. **Read the milestone's two advisory checks**, on a Feature with a
   milestone. A push to the milestone starts both, and `docs/ARCHITECTURE.md`,
   "How a criterion ships", says how they split the specs. Read each on its own;
   neither says anything about the other.
   - **`E2E build (advisory, existing specs)`**: a failing test is a regression
     candidate. Investigate it; a regression the milestone is carrying is a
     Bug, opened and kept from the integration pull request.
   - **`E2E build (advisory, Feature specs)`**: the Feature's own specs, red
     until their Task lands. Read it as progress, not as a regression.
   - **Skipped**: the log says no spec file is in that group, and nothing ran.
     That is not a pass of anything.
   - **Inconclusive**: a failed comparison, a step before the tests that
     failed, a cancelled leg or a timed-out one. It proves nothing either way;
     neither a pass nor a regression. Rerun it, or find what broke the leg.
   The log lists the spec files removed since the merge-base: none is tested.
   Each finished leg uploads its HTML report and traces under an artifact
   named after its group.
8. **Next.** On a Feature, go back to 1.

## Stops

Stop the loop and report where the Feature stands when:

- **A pull request needs the owner**: the specs, a spec correction, a
  migration, or anything into `main`. Name it and what they are approving.
  After a milestone carrying a migration reaches `main`, `Apply migrations`
  waits for their approval too, and every other milestone carrying a migration
  needs it regenerated (`docs/agents/issue-tracker.md`).
- **Checks are red** and the Subagent cannot make them green without changing
  a gate, a spec, or a decision outside the Task.
- **The frontier is empty but Tasks are open**: they are blocked, assigned or
  not Ready. Say which, and by what.
- **Every Task is closed.** Open the integration pull request,
  `milestone/<name> -> main`, titled after the Feature, its body written
  with the `pr` Skill, listing each merged Task and ending with
  `Closes #<feature>`. Set the Feature In Review.
  The owner approves it. A Feature with no specs has no milestone branch, so
  its last Task's pull request closes it, and a Feature whose every criterion
  the app already meets has none either, so its specs pull request closes it. For either, open
  no integration pull request: report that it is waiting on the owner.
- **The milestone needs something from `main`.** The owner syncs it (a merge
  commit they push, `docs/ARCHITECTURE.md`); a pull request cannot.

Resuming later is the same invocation. The state is on GitHub.
