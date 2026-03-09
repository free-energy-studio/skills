---
name: dev-workflow
description: End-to-end development workflow using Linear tickets, Ralph (autonomous coding agent), and Cursor Bug Bot. Use when assigned a ticket, asked to implement a feature, fix a bug, or work on any Linear issue. Triggers on ticket IDs (e.g. DEN-381), "work on", "implement", "build", or references to Linear tickets.
---

# Dev Workflow

Deterministic development flow: Ticket → PRD → Ralph → Bug Bot loop → QA handoff.

## Prerequisites

1. **Ralph installed globally** — Install via the skills repo:
   ```bash
   # One-liner from any machine
   curl -fsSL https://raw.githubusercontent.com/free-energy-studio/skills/main/install.sh | bash -s ralph

   # Or manually
   git clone https://github.com/free-energy-studio/skills.git ~/.local/share/free-energy-skills
   cd ~/.local/share/free-energy-skills/ralph && bun install && bun link
   ```
   Verify: `which ralph` should return a path.

2. **Claude Code CLI** — Installed and authenticated (`claude` in PATH)

3. **GitHub CLI** — Authenticated (`gh auth status`)

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

### 4. Run Ralph

```bash
ralph 25
```

Ralph runs up to 25 iterations, implementing one user story per iteration. It creates a branch, opens a draft PR, and works through each story.

Monitor progress: `tail -f .ralph/progress.txt`

### 5. Bug Bot Fix Loop

After Ralph finishes and the PR is up, use Claude Code's `/loop` to continuously monitor and fix Bug Bot comments:

```
/loop 5m Check the open PR on this branch for unresolved Cursor Bug Bot review comments. For each one: read the file and line referenced, understand the issue, implement the fix, and commit. After fixing all comments, push. If there are no unresolved Bug Bot comments, report "All clean — no unresolved Bug Bot comments" and stop.
```

This will:
1. Check for Bug Bot comments every 5 minutes
2. Fix each comment automatically
3. Push fixes and re-check on the next loop

The loop ends when there are no unresolved Bug Bot comments left. Once you see "All clean", move on to QA handoff.

### 6. QA Handoff

Once Bug Bot is clean:
1. Move the Linear ticket to **QA Review**
2. Mark the PR as ready for review: `gh pr ready`

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
