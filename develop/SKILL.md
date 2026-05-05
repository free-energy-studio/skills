---
name: develop
description: Development workflow for team-shared codebases with multiple concurrent collaborators. Use when cloning repos, creating working copies, planning implementation work, or executing code changes for Future Coach projects. Always apply for software development tasks so work stays isolated by repo, teammate, and task.
---

# Develop

Use this skill as the default operating method for coding work.

This skill also owns Future Coach preview publishing and preview lifecycle operations.

## Workspace layout

Treat these paths as the standard structure:

- Canonical clones: `/root/dev/repos/<repo>`
- Active worktrees: `/root/dev/worktrees/<repo>/<person>-<task>`
- Archive or parked state: `/root/dev/archive`
- Agent home and operating docs: `/root/.openclaw/workspace`

Never do active feature work in the canonical clone unless the user explicitly asks.

## Default workflow

For each new development request:

1. Identify the target repo.
2. Ensure the canonical clone exists under `/root/dev/repos/<repo>`.
3. Create or reuse a task-specific worktree under `/root/dev/worktrees/<repo>/<person>-<task>`.
4. Create a branch named `<person>/<task>` unless continuing existing work.
5. Do all implementation, testing, and commits in that worktree.
6. Keep the canonical clone clean for fetch, inspection, and new worktree creation.

Default rule: one request, one branch, one worktree.

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

1. Clone it into `/root/dev/repos/<repo>`.
2. Inspect README, package manifests, repo-local `AGENTS.md`, CI config, and top-level structure.
3. Note repo-specific constraints before editing.
4. Use those repo rules together with this skill.

## Verification

Before reporting completion, run the smallest sensible verification for the change:

- lint
- typecheck
- targeted tests
- broader tests only when needed

Call out when verification is partial because env, secrets, devices, or external services are missing.

## future-coach-app local dev environment

For `/root/dev/repos/future-coach-app` specifically:

### Code boundaries

- Treat `apps/app/src/components/ui/` as vendored and read-only.
- Put repeated styling or behavior changes in Orbit wrapper components.
- Put token/theme changes in the app theme files, not vendored primitives.
- Update `apps/app/app/style-guide.tsx` when adding design-system surface area.

### Runtime model

- Run active development from the worktree, not the canonical clone.
- Default to one shared dev Supabase/Postgres database across normal worktrees.
- Use isolated database environments only for risky auth, migration, destructive reset, or schema-heavy work.

### Env strategy

Use a shared-base plus per-worktree override model.

Shared env source:

- `/root/dev/env/future-coach-app.shared.env`

Per-worktree env files:

- `<worktree>/.env`
- `<worktree>/apps/api/.env`
- `<worktree>/apps/app/.env`

Rules:

- Keep a stable source of secrets outside git.
- Materialize per-worktree `.env` files from the shared env source when needed.
- Put common secrets in the shared env source.
- Put runtime overrides like ports and local URLs in the worktree env files.
- Treat shared secrets as common, but keep runtime overrides local to the worktree.
- When a worktree needs an isolated database, override only that worktree's `DATABASE_URL`.

Typical shared values:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` base for non-local environments when needed
- Twilio or other provider credentials

Typical worktree-local overrides:

- `PORT=<api-port>`
- `EXPO_PUBLIC_API_URL=http://localhost:<api-port>`
- any temporary task-specific flags

### Port strategy

When multiple worktrees run at once, assign distinct API ports and matching app API URLs.

Suggested convention:

- default worktree API: `8787`
- next worktree API: `8788`
- next worktree API: `8789`

Each worktree's app env should point to its matching local API origin.

### Tunnel strategy

Use Cloudflare Tunnel as the default preview path for shareable worktree previews.

Current box setup:

- Named tunnel: `dev-previews-futurecoach`
- Tunnel ID: `05252ba9-04a5-4eaf-b4eb-7b2ff33211dc`
- Tunnel config: `/root/.cloudflared/config.yml`
- Tunnel credentials: `/root/.cloudflared/05252ba9-04a5-4eaf-b4eb-7b2ff33211dc.json`
- Wildcard DNS route: `*.futurecoach.dev`
- Local reverse proxy: Caddy
- Caddy root config: `/etc/caddy/Caddyfile`
- Preview host mappings: `/etc/futurecoach/previews.d/*.caddy`

Operating method:

- Authenticate `cloudflared` once on the box and reuse that auth.
- Use one named tunnel for dev previews, not one tunnel per task.
- Route all `*.futurecoach.dev` traffic through the named tunnel to local Caddy.
- Add one host mapping per active preview in `/etc/futurecoach/previews.d/`.
- Reload Caddy after adding, updating, or removing preview mappings.
- Keep preview routing consistent with the worktree naming convention.
- Stop or repoint previews when the underlying worktree is no longer active.

Recommended hostname pattern:

- `<person>-<task>.futurecoach.dev`

Operational rules:

- One active preview URL should point to one worktree app instance.
- Do not reuse the same preview hostname for two different live worktrees at once.
- Default to separate app and API processes per worktree when backend behavior differs.
- Prefer one port pair per worktree, for example app web `8081` + API `8787`, app web `8082` + API `8788`.
- Treat preview URLs as development surfaces, not production endpoints.

Implementation pattern:

1. Start the worktree's API on its assigned port.
2. Start the worktree's web app on its assigned port.
3. Point the worktree app env at its matching API port.
4. Create a Caddy host entry for `<person>-<task>.futurecoach.dev` to the app web port.
5. Reload Caddy.
6. Ensure the named Cloudflare tunnel is running.

### Database policy

Use the shared dev database for:

- UI work
- most API work
- non-destructive feature work

Escalate to an isolated database environment for:

- Drizzle migrations
- Better Auth model or plugin changes
- destructive seed/reset flows
- experiments that can corrupt shared dev state

### Verification expectations

For local iteration, prefer the smallest useful validation:

- `bun run lint`
- `bun run typecheck`
- targeted tests for touched packages
- app or API dev server smoke checks from the worktree

## Operating procedures

### Creating a new worktree

For a new task:

1. Start from the canonical clone in `/root/dev/repos/<repo>`.
2. Fetch latest refs before branching when network access is relevant.
3. Create a worktree at `/root/dev/worktrees/<repo>/<person>-<task>`.
4. Create a branch named `<person>/<task>` unless continuing an existing one.
5. Do not begin implementation in the canonical clone.

### Resuming existing work

When continuing existing work:

1. Check `git worktree list` from the canonical clone.
2. Reuse the matching worktree if it already exists.
3. Verify branch, status, and uncommitted changes before making edits.
4. Do not create a duplicate worktree for the same branch unless explicitly needed.

### Env materialization for future-coach-app

For each future-coach-app worktree:

1. Start from `/root/dev/env/future-coach-app.shared.env`.
2. Create worktree-local env files in the repo root, `apps/api/.env`, and `apps/app/.env` as needed.
3. Set worktree-local overrides for:
   - API port
   - app web port if applicable
   - `EXPO_PUBLIC_API_URL`
   - any task-specific flags
4. Keep the shared base file free of task-specific port allocations.
5. If isolated DB mode is needed, override `DATABASE_URL` only in that worktree.

### Port allocation rules

Use one port pair per active future-coach-app worktree.

Suggested allocation order:

- Worktree 1: app `8081`, api `8787`
- Worktree 2: app `8082`, api `8788`
- Worktree 3: app `8083`, api `8789`

Rules:

- Do not reuse a live port pair already assigned to another active worktree.
- Keep the app pointed at its matching API port.
- Prefer predictable incremental assignment over ad hoc random ports.

### Running local processes

For future-coach-app, default to separate processes per worktree:

- one API process per worktree
- one app/web process per worktree

Rules:

- Start processes from the worktree, not the canonical clone.
- Label or document which ports belong to which worktree.
- If backend behavior differs between branches, do not share API processes.

### Preview registration and removal

For `future-coach-app`, use the develop-owned automation script:

```sh
sudo /root/.openclaw/workspace/skills/develop/scripts/develop.sh preview up <name> --app-port <app-port> --api-port <api-port> --worktree <path>
sudo /root/.openclaw/workspace/skills/develop/scripts/develop.sh preview up <name> --auto-ports --worktree <path> --launch
/root/.openclaw/workspace/skills/develop/scripts/develop.sh preview check <name>
sudo /root/.openclaw/workspace/skills/develop/scripts/develop.sh preview down <name> --stop
/root/.openclaw/workspace/skills/develop/scripts/develop.sh preview suggest-ports
```

Use this path for preview publishing, checking, troubleshooting, and removal. Do not hand-roll preview env files or proxy rules when the scripted path exists, unless you are actively repairing the preview system itself.

### Verification before handoff

Before reporting a coding task complete:

1. Check git diff and changed files.
2. Run the smallest useful verification.
3. Note any skipped checks.
4. Summarize what changed, how it was verified, and any remaining risk.

### Commit and PR posture

Default behavior:

- make focused commits when the user asks for commit-ready work or when the task naturally reaches a stable checkpoint
- avoid bundling unrelated cleanup into the same branch
- do not push or open PRs unless asked or clearly implied by the task

### Cleanup and lifecycle

When work is finished or abandoned:

1. Stop related local processes.
2. Remove preview routing if it exists.
3. Keep the worktree if the branch is still active or likely to resume soon.
4. Remove stale worktrees once merged, abandoned, or explicitly parked elsewhere.
5. Never remove a worktree with unreviewed uncommitted changes unless the user asks.

## Practical conventions

Preferred path examples:

- `/root/dev/repos/future-coach-app`
- `/root/dev/worktrees/future-coach-app/sam-auth-polish`
- `/root/dev/worktrees/future-coach-app/alex-profile-bugfix`

Preferred branch examples:

- `sam/auth-polish`
- `alex/profile-bugfix`
- `jordan/api-onboarding-step`

If the teammate name is unknown, use a short neutral owner like `team/<task>` or `coach/<task>`.
