---
name: dev-workflow
description: End-to-end development workflow using Linear tickets, Ralph (autonomous coding agent), and Cursor Bug Bot. Use when assigned a ticket, asked to implement a feature, fix a bug, or work on any Linear issue. Triggers on ticket IDs (e.g. DEN-381), "work on", "implement", "build", or references to Linear tickets.
---

# Dev Workflow

Deterministic development flow: Ticket → PRD → Ralph → Bug Bot loop → QA handoff.

## Prerequisites

1. **Non-root dev user** — Claude Code refuses `--dangerously-skip-permissions` as root. All development work (git, file editing, ralph, claude code) must run as a dedicated non-root user (e.g. `dev`). Setup:
   - Project files owned by this user (`chown -R dev:dev /projects/`)
   - `gh auth login` completed (needed for push + PR creation)
   - `claude` CLI installed and authenticated (OAuth)
   - Root is only for system-level tasks (apt, services, openclaw)

2. **Ralph installed** — `bun add github:free-energy-studio/ralph` in the target project. Postinstall handles `.gitignore` and `/prd` skill setup. If postinstall is blocked, run `bunx ralph-init`.

Verify: `ls node_modules/ralph/ralph.js` and `.claude/skills/prd/` exists (symlink).

## Flow

### 1. Discovery & Q/A

Before writing any code, understand the problem:

- **Scope** — What's in, what's out?
- **Existing patterns** — How does the codebase handle similar features?
- **Dependencies** — Does this touch other features or require migrations?
- **Edge cases** — What could go wrong? Empty states, permissions, error handling?
- **UX expectations** — Any specific UI patterns, copy, or interactions expected?

**How to research:**
1. Explore relevant code — schemas, routes, components, tests
2. Check related tickets or PRs for context
3. Ask the assigner specific questions — don't guess on ambiguous requirements

**When to move on:** When scope is clear, questions are answered, and you could explain the task to another developer.

### 2. Create or Update Ticket

Every task requires a Linear ticket with enough detail that a developer with zero context could implement it.

- **No ticket exists?** Create one with: what, why, acceptance criteria, edge cases, dependencies
- **Ticket exists but vague?** Update it with findings from discovery
- Move ticket to **To Do**

### 3. Generate PRD

In Claude Code (in the project directory):

```
/ralph TICKET-ID
```

This creates `.ralph/prd.json` with atomic user stories. Review the output — stories should be small (1-3 files each), independently verifiable, and ordered by dependency.

If `/ralph` command is not available, symlink the skill into `.claude/skills/ralph/`.

### 4. Run the Dev Workflow (Lobster)

Run the full pipeline — Ralph + Bug Bot loop + QA handoff — as a single Lobster workflow:

```
Run the dev-workflow Lobster pipeline with ticket=DOMA-XXX
```

This runs `dev-workflow.lobster` which:
1. Runs Ralph (up to 25 iterations)
2. Waits 5 minutes for Bug Bot to post
3. Shows you Bug Bot comments and **pauses for approval**
4. If you approve (comments addressed or none) → moves ticket to QA Review
5. If you deny → fix the issues, update `.ralph/prd.json`, and re-run

**The approval gate is mandatory. You cannot skip to QA without explicitly approving.**

If Bug Bot finds issues after you approve:
- Update `.ralph/prd.json` with the Bug Bot comments as new user stories
- Re-run the Lobster workflow
- Repeat until Bug Bot is clean

### 5. QA Handoff

Handled automatically by the Lobster workflow on approval. Ticket moves to **QA Review**.

**Do not merge** — reviewer merges after approval.

## Decision Points

- **Ticket too vague?** → Ask for clarification before creating PRD. Don't guess.
- **Ralph fails repeatedly on a story?** → Read progress.txt for error patterns. May need to manually fix and re-run.
- **Bug Bot finds architectural issues?** → Flag to reviewer — may need design discussion before fixing.
- **PR has merge conflicts?** → Rebase onto base branch before re-running Ralph.

## Linear Status Map

| Stage | Linear Status |
|-------|--------------|
| PRD generation | To Do |
| Ralph running | In Progress |
| Bug Bot loop | Code Review |
| Awaiting human review | QA Review |
| Approved + merged | Done |
