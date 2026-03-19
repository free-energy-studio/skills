---
name: vibe-coding
description: Cross-repo worktree-based development workflow for Domain projects. Use when setting up or enforcing a team coding process with Dr. Doma as git committer, humans as git authors, git worktrees for every task, and ngrok previews based on the worktree slug. Triggers on requests about vibe coding, worktrees, git author/committer enforcement, cross-repo process, or ngrok preview workflow.
---

# Vibe Coding

Use the shared `doma` CLI instead of repo-specific scripts.

## Workflow

1. Run `vibe setup` inside the repo.
2. Define repo preview defaults with `vibe repo init --preview-cmd ... --preview-port ...`.
3. Create a task worktree with `vibe worktree create <branch> --author-name ... --author-email ...`.
4. Work inside the worktree.
5. Commit with `vibe commit ...`, never plain `git commit`.
6. Launch previews with `vibe preview start`.

## Contract

- Committer is always `Dr. Doma <doma@ondomain.ai>`.
- Author is stored in per-worktree git config under `doma.authorName` and `doma.authorEmail`.
- Worktree metadata lives in git worktree config: `doma.worktreeName` and `doma.previewSlug`.
- Repos declare only the preview defaults in `.doma.json`.
- Preview URL is always `https://<preview-slug>.<base-domain>`.

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

- `scripts/doma.js` — shared cross-repo CLI
