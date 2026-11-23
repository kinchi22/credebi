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

Take one Task at a time, each in an Agent worktree of its own, made as
`docs/agents/harnesses.md` says, whether or not any other session is using the
repository's primary tree: isolation never depends on your judging whether it is
busy. The loop stays serial. The gates share nothing but port 3000, which is why
a worktree is enough: `pnpm test:integration` starts a throwaway Postgres of its
own through testcontainers, on a port it picks
(`tools/integration/postgres-container.ts`); the container in
`docker-compose.yml` is the development database and no gate touches it.
`db:drift` and `db:check` read files and never connect.

`playwright.config.ts` binds `127.0.0.1:3000` and reuses a server already
listening, so a server another session started silently answers a local e2e run.
The Implementer returns to you when the port is busy before one.

Each Agent worktree is removed once its pull request has merged. When a loop
resumes, list the worktrees with `git worktree list --porcelain` and consider
only those under the two directories `docs/agents/harnesses.md` names for an
Agent worktree: never the primary tree, never one made by other tooling. Map
each to its pull request through the branch checked out there (`gh pr list
--head <branch> --state merged`, then `--state open`, then `--state closed`),
and classify it:

- A merged pull request: remove it, with no liveness check. Its work is on
  `main`, and no branch of another tool maps to a merged pull request of this
  loop.
- An open pull request: keep it. The review of that pull request happens inside
  it.
- No Task branch, a Task branch with no pull request, or a pull request closed
  without merging: remove it unless it is live. An Implementer that stopped on
  a question or failed part-way leaves such a worktree, and no Subagent of an
  earlier session can continue in it, since step 3 sends a fresh Implementer
  into a new Agent worktree. A worktree is live while another session's
  Implementer may still be running in it, and until that Implementer branches it
  looks exactly like an abandoned one, so removing a live worktree deletes a
  build mid-run. `docs/agents/harnesses.md` says what live means on each
  Harness and which worktrees are candidates.

An abandoned worktree is removed with the same command as a merged one, and its
local branches are deleted as that file says. Uncommitted changes and unpushed
commits go with it, without asking: an Agent worktree holds no state that
GitHub Issues does not.

1. **Pick.** The first frontier Task, specs first. An empty frontier is a stop.
2. **Build.** Dispatch an Implementer Subagent into a new Agent worktree, from
   the `implementer` Agent definition, with the prompt: "Implement
   issue #<n>. Follow `docs/agents/skills/implement-issue-implementer.md`." Pass
   nothing else; the issue is the brief, and the worktree is how it is
   dispatched, not something the prompt carries. It returns a pull request
   number, or a question, and `docs/agents/harnesses.md` says how you learn the
   worktree's path.
3. **Answer questions.** A question means the Task left a decision open. Put it
   to the owner, write the answer into the issue as a comment, and send the same
   Subagent on. When the answer changes the Task's scope, edit the issue body
   too. When the Subagent's worktree is gone by now, dispatch a fresh
   Implementer into a new Agent worktree instead: the answer is already on the
   issue.
4. **Review.** Inside the Implementer's worktree, run `git fetch origin` and
   invoke the `code-review` Skill with `origin/<base>`, the pull request's base
   branch, as the fixed point. The review changes no files, and never checks a
   branch out in the primary tree. The spec is the Task, and its Feature's body
   for context. Post the report on the pull request as a comment.
5. **Fix.** When either axis reports a hard violation, or a requirement missing
   or wrong, send the findings back to the same Subagent and review again.
   Judgement calls are the Subagent's to take or leave, with a reason in the
   pull request. After a second review that still fails, stop.
6. **Fold in, then ticket the leftovers.** A real problem is behaviour that is
   wrong, a document that contradicts the code or itself, a second source of
   truth that can drift, or a criterion nothing checks. A naming or shape smell
   is not one, and stays in the review comment.
   A real problem the reviews raised goes back to the same Subagent, as in step
   5, when the fix that closes the Task reaches it: it sits in code the diff
   touches, it is the same defect copied into a sibling, or it is a duplicate
   the fix would merge into one implementation. Add it to the issue body as
   scope, and it is no longer the Subagent's to leave. It stays out when it
   needs the owner's decision, touches an owned path, changes another issue's
   criteria, is a different defect, or would take the pull request past one
   session.
   Before merging, open an issue for each real problem that stays out, whether
   a judgement call the Subagent left or a finding outside the Task. Open each
   one without asking the owner: a defect as a Bug, anything else as a Feature
   with its kind, and a choice only the owner can make written into its body as
   the decision needed. Whether to act on it is decided later, from the issue.
   Link each from the review comment.
7. **Merge.** Wait for the required checks (`gh pr checks <pr> --watch
   --required`). Green, and with no owned path in the diff, merge it:
   `gh pr merge <pr> --squash`. Only once the merge has succeeded, remove the
   Agent worktree and its local branches as `docs/agents/harnesses.md` says; a
   failed merge leaves the worktree for step 5. An owned path, or a pull request
   into `main`, waits for the owner: that is a stop.
8. **Read the milestone's two advisory checks**, on a Feature with a
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
9. **Next.** On a Feature, go back to 1.

## Stops

Stop the loop and report where the Feature stands when, leaving any Agent
worktree in place and naming its path in the report:

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
