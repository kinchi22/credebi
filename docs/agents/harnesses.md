# Harnesses

`AGENTS.md` states each rule once, in words that belong to no harness. This file
is where those words become something a session can actually run: one table
mapping a concept to the mechanism each harness gives you, and one defining the
words themselves.

It is the only file allowed to name `.claude/` or `.codex/`. Everywhere else --
the agreement, the tracker, a Skill body -- a rule says what a thing *is*, so an
instruction a harness cannot literally execute is never mistaken for one it may
skip.

`README.md` is written for a person setting a clone up rather than for an agent
following it, so it names harness directories where it has to.

Two harnesses are supported: Claude Code and Codex. Nothing here is built for a
third, and nothing obstructs one either: it would cost a stub directory and a
column below.

## Concept to mechanism

| Concept | Claude Code | Codex |
| ------- | ----------- | ----- |
| Working agreement | `CLAUDE.md`, whose whole body is the line `@AGENTS.md`. `AGENTS.md` is read natively only when no `CLAUDE.md` or `CLAUDE.local.md` exists anywhere up the tree, and the setting that changes that is user-scoped, so a repository cannot commit it: the import is what makes the agreement arrive, not native support. | `AGENTS.md`, read directly. One file per directory is merged from the repository root down to the working directory, the merged result is capped at 32 KiB, and there is no import syntax -- which is why the agreement is self-contained prose rather than a set of includes. |
| Personal instructions | `CLAUDE.local.md` beside the agreement, or `~/.claude/CLAUDE.md` for every repository. Untracked, and `.gitignore` keeps it that way. | `~/.codex/AGENTS.md`. Never a committed `AGENTS.override.md`: an override *replaces* the `AGENTS.md` in its own directory rather than extending it, so at the repository root it would discard every rule in the agreement. |
| Skill body | `docs/agents/skills/<name>.md`. | The same file. Neither harness reads the other's skill directory, so the prose lives outside both and each harness reaches it through a stub. |
| Skill stub | `.claude/skills/<name>/SKILL.md`: frontmatter `name`, `description` and `disable-model-invocation`, over a body that is one line pointing at the Skill body. | `.agents/skills/<name>/SKILL.md`: the same one-line body, with `name` and `description`, and a sibling `agents/openai.yaml` carrying `interface.display_name`, `interface.short_description` and `policy.allow_implicit_invocation`. |
| Invoking a Skill | The owner types `/<name>`. | The owner picks it by name from the skills the harness lists. |
| Keeping a Skill human-only | `disable-model-invocation: true` in the stub's frontmatter. | `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. |
| External Skills | `code-review`, `pr`, `tdd`, `grill-with-docs`, `to-spec` and `to-tickets` are not vendored here. `enabledPlugins` in the committed `.claude/settings.json` enables them for this repository, so a clone needs no install step. | The same six, from the same upstream. There is no committed equivalent of `enabledPlugins`, so they are installed once per machine. |
| Subagent | A subagent dispatched with the agent tool, handed a brief path and nothing else; later findings go back to that same subagent, so its context survives the round trip. | A delegated agent run given the same brief. Where delegation is unavailable, a separate session on that brief does what the rule asks for: a context separate from the one that reviews it. |
| Agent definition | `.claude/agents/<name>.md`: frontmatter `name`, `description` and `model`, over a body that is one line pointing at the role's brief. `implementer.md` sets `model: sonnet`: building is bounded by the issue and checked by the gates and a review, so it runs a step below the session that reviews it. The Driver dispatches it by passing `<name>` as the agent tool's subagent type, and passes no model of its own. | None committed. `.codex/` is per-machine, so a delegated run inherits the session's model. |
| Agent worktree | Where it lives: `.claude/worktrees/<name>`, which no committed setting moves. Made by dispatching the `implementer` Agent definition with worktree isolation. The Driver learns its path from the Subagent's result. Claude Code removes an isolation worktree with no changes when its Subagent returns. Claude Code names an isolation worktree `agent-*`, and only a worktree so named is a candidate for the sweep of an unmerged one; any other name there, such as a remote session's `bridge-*`, is left alone. It is live while it is locked and the pid in its lock reason is still running; one with no lock, or a lock whose pid is gone, is not live. | Where it lives: `.agents/worktrees/<task>`. The Driver makes it by hand after `git fetch origin` with `git worktree add --detach .agents/worktrees/<task> origin/<base>`, so no branch is made beside the Task's, starts the delegated run with that directory as its working directory, and knows the path because it chose it. Every worktree there is a candidate for the sweep of an unmerged one. One clone runs at most one Codex Driver at a time and the Driver adds no lock, so the sweep treats every Codex Agent worktree as not live. |
| Removing an Agent worktree | `git worktree remove -f -f <path>`, which loses nothing: everything that matters is on GitHub. Claude Code locks an isolation worktree while the session that dispatched its Subagent lives, so a single `--force` is refused, and the second `-f` overrides that lock. Then `git branch -D` for the Task's branch and for the branch the isolation created, named `worktree-` followed by the worktree's directory name. | `git worktree remove --force <path>`, then `git branch -D` for the Task's branch. |
| Untracked files in an Agent worktree | `.worktreeinclude` names the ignored files Claude Code copies into a worktree it makes: `.env` and `CLAUDE.local.md`. | No committed equivalent; the Driver copies `.env` by hand when it makes the worktree. The personal instructions file lives outside the repository, so there is nothing to copy. |

## Vocabulary

One canonical name per concept, the rule `docs/GLOSSARY.md` states for the
domain. None of these is a bookkeeping term -- they name how the product is
worked on rather than what it is built from -- so they are defined here instead,
and no term is defined in both tables.

| Term | Meaning |
| ---- | ------- |
| Harness | The agent tool a session runs in: Claude Code or Codex. It supplies the mechanisms in the table above and no rules of its own; the rules are the Working agreement, and they are the same whichever Harness reads them. |
| Working agreement | `AGENTS.md`: the rules for working in this repository, written once and read by every Harness. A rule lives there or nowhere. `CLAUDE.md` is an import of it and holds nothing else. |
| Skill | A named procedure a Harness loads when it is invoked. Its prose is a **Skill body** under `docs/agents/skills/`, written once; each Harness has a **Skill stub** in its own skill directory whose body points at it. `implement-issue` is invoked by a person alone, never by a model. |
| Driver | The role that runs the `implement-issue` loop: it picks a Task, dispatches an Implementer, reviews what comes back, and merges it or stops for the owner. It builds nothing itself. |
| Implementer | The role that builds one Task and opens its pull request. It reads its own brief and the issue, and none of the Driver's loop, so the review of its work happens in a context that did not write the code. |
| Subagent | An agent a session starts, hands a brief and gets a result from, with a context of its own. The Driver dispatches the Implementer as one. |
| Agent definition | A named Subagent a Harness can start with its model fixed in a committed file, where the Harness has one, so the model is the definition's to set rather than the dispatching session's. `implementer` is the one there is. |
| Agent worktree | A `git worktree` beside the primary tree (the clone itself), at the path the table above names, where every Task is built. Disposable: it holds no state that GitHub Issues does not. |
