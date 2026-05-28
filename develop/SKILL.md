---
name: develop
description: Default development workflow for team-shared codebases with multiple concurrent collaborators. Use when cloning repos, creating working copies, planning implementation work, or executing code changes. Keeps work isolated by repo, teammate, and task using a canonical-clone + worktree pattern.
---

# Develop

Use this skill as the default operating method for coding work on any repo.

## Core principle

One request, one branch, one worktree.

Keep canonical clones clean. Do active work in task-specific worktrees so multiple teammates and tasks can run side by side without stepping on each other.

## Workspace layout

Standard structure (paths can be overridden per-machine, but keep the shape):

- Canonical clones: `<dev-root>/repos/<repo>`
- Active worktrees: `<dev-root>/worktrees/<repo>/<person>-<task>`
- Archive / parked state: `<dev-root>/archive`

Common default for `<dev-root>` is `~/dev` or `/root/dev`. Whatever the host uses, keep it consistent.

Never do active feature work in the canonical clone unless explicitly asked.

## Default workflow

For each new development request:

1. Identify the target repo.
2. Ensure the canonical clone exists under `<dev-root>/repos/<repo>`.
3. Create or reuse a task-specific worktree under `<dev-root>/worktrees/<repo>/<person>-<task>`.
4. Create a branch named `<person>/<task>` unless continuing existing work.
5. Do all implementation, testing, and commits in that worktree.
6. Keep the canonical clone clean for fetch, inspection, and new worktree creation.

## Collaboration rules

When multiple team members ask for development work:

- Separate each teammate or task into its own branch and worktree.
- Do not mix unrelated requests in one working tree.
- Do not carry private or ambiguous context from one teammate request into another.
- Prefer small, reviewable diffs.
- Summarize changes, verification, and risks clearly when done.

If a user says to continue existing work, resume the matching worktree instead of creating a new one.

## Repo handling

When pulling a new repo:

1. Clone it into `<dev-root>/repos/<repo>`.
2. Inspect README, package manifests, repo-local `AGENTS.md`, CI config, and top-level structure.
3. Note repo-specific constraints before editing.
4. Use those repo rules together with this skill.

## Operating procedures

### Creating a new worktree

1. Start from the canonical clone in `<dev-root>/repos/<repo>`.
2. Fetch latest refs before branching when network access is relevant.
3. Create a worktree at `<dev-root>/worktrees/<repo>/<person>-<task>`.
4. Create a branch named `<person>/<task>` unless continuing an existing one.
5. Do not begin implementation in the canonical clone.

### Resuming existing work

1. Run `git worktree list` from the canonical clone.
2. Reuse the matching worktree if it already exists.
3. Verify branch, status, and uncommitted changes before making edits.
4. Do not create a duplicate worktree for the same branch unless explicitly needed.

### Env strategy

Use a shared-base plus per-worktree override model when a repo needs env files:

- Keep a stable source of secrets outside git (e.g. `<dev-root>/env/<repo>.shared.env`).
- Materialize per-worktree env files from the shared source as needed.
- Put common secrets in the shared source.
- Put runtime overrides (ports, local URLs, task-specific flags) in the worktree env files.
- When a worktree needs an isolated database or service, override only that value locally.

### Port allocation

When multiple worktrees run at once, give each its own port pair (or set) so processes don't collide. Prefer predictable incremental assignment (e.g. `8081/8787`, `8082/8788`, ...) over ad hoc random ports. Document which ports belong to which worktree.

### Running local processes

- Start processes from the worktree, not the canonical clone.
- Default to separate processes per worktree when backend behavior differs between branches.
- Stop related processes when the worktree is finished or parked.

### Previews / sharing

If the project needs shareable preview URLs per worktree (reverse proxy + tunnel pattern), keep that automation **project-specific** — typically a script in the repo or a separate ops skill. Don't hardcode project domains, tunnel names, or proxy paths into this skill.

Common pattern when one is needed:

1. Start the worktree's services on their assigned ports.
2. Add a host entry in the project's reverse proxy.
3. Reload the proxy.
4. Ensure the shared tunnel/ingress is running.
5. Use a hostname pattern like `<person>-<task>.<project-domain>`.

### Verification before handoff

Before reporting a coding task complete:

1. Check `git diff` and changed files.
2. Run the smallest useful verification — lint, typecheck, targeted tests, or a smoke run.
3. Note any skipped checks (missing env, secrets, devices, external services).
4. Summarize what changed, how it was verified, and any remaining risk.

### Commit and PR posture

- Make focused commits when the user asks for commit-ready work or when the task naturally reaches a stable checkpoint.
- Avoid bundling unrelated cleanup into the same branch.
- Do not push or open PRs unless asked or clearly implied by the task.

### Cleanup and lifecycle

When work is finished or abandoned:

1. Stop related local processes.
2. Remove preview routing if it exists.
3. Keep the worktree if the branch is still active or likely to resume soon.
4. Remove stale worktrees once merged, abandoned, or explicitly parked.
5. Never remove a worktree with unreviewed uncommitted changes unless the user asks.

## Branch naming

Preferred:

- `<person>/<task>` — e.g. `sam/auth-polish`, `alex/profile-bugfix`

If the teammate is unknown, use a short neutral owner like `team/<task>`.

## Project-specific extensions

This skill defines the methodology. Project-specific details — exact ports, env files, preview tooling, code-boundary rules, database policy — belong in:

- the project's repo (`AGENTS.md`, `README`, ops scripts), or
- a separate per-project skill that layers on top of this one.

Keep this skill generic so it stays useful across every repo.
