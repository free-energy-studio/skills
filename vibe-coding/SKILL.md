---
name: vibe-coding
description: Cross-repo worktree-based development workflow. Use when setting up or enforcing a team coding process with a dedicated git committer identity, humans as git authors, git worktrees for every task, and ngrok previews based on the worktree slug. Triggers on requests about vibe coding, worktrees, git author/committer enforcement, cross-repo process, or ngrok preview workflow.
---

# Vibe Coding

Use the shared `vibe` CLI instead of repo-specific scripts.

## Install

From the skill directory:

```bash
npm link
```

Or call directly: `node scripts/vibe.js <command>`.

## Workflow

1. Run `vibe setup --committer-name "..." --committer-email "..."` inside the repo.
2. Define repo preview defaults with `vibe repo init --preview-cmd ... --preview-port ...`.
3. Create a task worktree with `vibe worktree create <branch> --author-name ... --author-email ...`.
4. Work inside the worktree.
5. Commit with `vibe commit ...`, never plain `git commit`.
6. Launch previews with `vibe preview start`.

## Commands

```
vibe setup                          Configure repo for vibe coding
  --committer-name <name>            Bot/agent name (required on first setup)
  --committer-email <email>          Bot/agent email (required on first setup)
  --worktrees-root <path>            Base dir for worktrees (default: /root/projects/.worktrees)
  --preview-base-domain <domain>     Base domain (default: ondomain.dev)
vibe repo init                      Set preview defaults in .vibe.json
  --preview-cmd <command>             App start command (required)
  --preview-port <port>               App port (required)
  --preview-base-domain <domain>      Base domain (default: ondomain.dev)
vibe worktree create <name>         Create a new worktree
  --author-name <name>                Git author name (required)
  --author-email <email>              Git author email (required)
  --base <branch>                     Base branch (default: main)
vibe commit [git-commit-args...]    Commit with enforced author/committer
vibe preview start                  Start app + ngrok preview
  --port <port>                       Override preview port
  --cmd <command>                     Override preview command
  --base-domain <domain>              Override base domain
vibe hook pre-commit                Pre-commit hook (installed by setup)
```

## Contract

- Committer is the bot/agent doing the work — set its name and email during `vibe setup`.
- Author is the human who directed the work — set per worktree via `vibe worktree create`.
- Worktree metadata lives in git worktree config: `vibe.worktreeName` and `vibe.previewSlug`.
- Repos declare preview defaults in `.vibe.json`.
- Preview URL is always `https://<preview-slug>.<base-domain>`.

## Configuration

Git config keys (set via `git config`):

| Key | Scope | Default | Description |
|-----|-------|---------|-------------|
| `vibe.committerName` | repo | — (required) | Bot/agent name |
| `vibe.committerEmail` | repo | — (required) | Bot/agent email |
| `vibe.worktreesRoot` | repo | `/root/projects/.worktrees` | Base directory for worktrees |
| `vibe.previewBaseDomain` | repo | `ondomain.dev` | Default preview domain |
| `vibe.worktreeName` | worktree | branch name | Worktree display name |
| `vibe.authorName` | worktree | — | Author name for commits |
| `vibe.authorEmail` | worktree | — | Author email for commits |
| `vibe.previewSlug` | worktree | slugified name | Subdomain for preview URL |

## Repo Manifest

Create a tracked `.vibe.json` file with preview defaults:

```json
{
  "preview": {
    "command": "cd feed && bun run server.ts",
    "port": 4000,
    "baseDomain": "ondomain.dev"
  }
}
```

Only put repo-specific behavior in the manifest. Keep the author/committer and worktree policy in the shared CLI.

## Resources

- `scripts/vibe.js` — shared cross-repo CLI
