---
name: vibe-coding
description: Cross-repo worktree-based development workflow. Use when setting up or enforcing a team coding process with a dedicated AI/bot committer, human authors, git worktrees for every task, and ngrok previews that use repo-prefixed worktree slugs. Triggers on requests about vibe coding, worktrees, git author/committer enforcement, cross-repo process, or ngrok preview workflow.
---

# Vibe Coding

Use the shared `vibe` CLI instead of repo-specific scripts.

## Workflow

1. Run `vibe setup` inside the repo.
2. Define repo preview defaults with `vibe repo init --preview-cmd ... --preview-port ...`.
3. Create a task worktree with `vibe worktree create <branch> --author-name ... --author-email ...`.
4. Work inside the worktree.
5. Commit with `vibe commit ...`, never plain `git commit`.
6. Launch previews with `vibe preview start`.

## Contract

- Committer identity lives in repo git config under `vibe.committerName` and `vibe.committerEmail`.
- Author identity lives in per-worktree git config under `vibe.authorName` and `vibe.authorEmail`.
- Worktree metadata lives in git worktree config under `vibe.worktreeName` and `vibe.previewSlug`.
- `vibe.previewSlug` defaults to `<repo-slug>-<worktree-slug>`.
- Repos declare only the preview defaults in `.vibe.json`.
- Preview URL is always `https://<preview-slug>.<base-domain>`.

## Repo Manifest

Create a tracked `.vibe.json` file with preview defaults:

```json
{
  "preview": {
    "command": "cd app && npm run dev",
    "port": 3000,
    "baseDomain": "ngrok.app"
  }
}
```

Only put repo-specific behavior in the manifest. Keep committer/author/worktree policy in git config managed by the shared CLI.

## Resources

- `scripts/vibe.js` — shared cross-repo CLI
