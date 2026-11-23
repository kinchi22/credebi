# Implementing one Task

This is the Implementer's brief. `docs/agents/harnesses.md` defines the words
used here -- Driver, Implementer, Subagent, Skill -- and maps each to the
mechanism your harness gives you.

You are dispatched into an Agent worktree of your own and build there, never in
the primary tree. You build one Task and open its pull request. The Driver that dispatched you
reviews and merges it. `docs/agents/issue-tracker.md` holds the Status values,
the base branch for your Task and the `gh` commands.

1. **Read.** `gh issue view <n> --comments`, its Feature's body, and the ADRs
   in the area you will touch. The Task and its Feature are the whole
   requirement. A decision they leave open, and that `docs/ARCHITECTURE.md` or
   an Accepted ADR does not fix, is a question: return it to the Driver and
   stop until it answers.
2. **Claim.** Assign yourself and set the Task In Progress.
3. **Branch.** From the Task's base branch, fetched fresh:
   `git switch -c <type>/<short-name> origin/<base>`. The specs Task of a
   Feature whose every criterion the app already meets targets `main` and creates no milestone. For
   any other specs Task, create `milestone/<name>` from `origin/main` first when
   it does not exist:
   `git push origin origin/main:refs/heads/milestone/<name>`.
   When the push is refused, return that to the Driver: the owner creates it.
4. **Install.** In the worktree, `pnpm install --frozen-lockfile
   --reporter=silent`. When it fails, rerun it without the reporter flag to see
   why.
5. **Build.** Test-first, with the `tdd` Skill. Stay inside the Task. Work you
   find that it does not cover becomes a new issue, labelled and added as a
   sub-issue of the Feature, and you carry on without it. Before every commit
   and every push, check that `git rev-parse --show-toplevel` is your worktree
   and `git branch --show-current` is your Task's branch. On a mismatch change
   nothing and return it to the Driver.
6. **Gate.** `pnpm gates` passes. A specs Task passes
   `pnpm verify:gates:e2e` too: every spec fails against an empty page. Before
   a local e2e run, check that `127.0.0.1:3000` is free
   (`lsof -nP -iTCP:3000 -sTCP:LISTEN` prints nothing); when it is not, return
   to the Driver and stop.
7. **Open.** Push and open the pull request into the base branch. The title is
   the change in the imperative, as the log reads. Write the body with the `pr`
   Skill. Its Merge Danger names every owned path in the diff and why the owner
   is needed, and the body ends with `Closes #<n>`. When the pull request also closes the Feature --
   the specs Task of a Feature whose every criterion the app already meets, or
   the last Task of a Feature with no specs -- it carries `Closes #<feature>` as
   well. Set the Task In Review.
8. **Return** the pull request number once its required checks finish:
   `gh pr checks <n> --watch --required` is the one wait, and it ends by itself.
   Every server, database and process you started is stopped first, so the
   next Task finds port 3000 free.

When the Driver sends review findings, fix them on the same branch, run the
gates again, push, and return the number again, the same way.
