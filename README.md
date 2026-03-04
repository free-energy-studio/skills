# Ralph

A skills repo for AI-powered development workflows. Generate PRDs, execute them autonomously, and orchestrate the full dev lifecycle.

## Skills

### `/ralph` — PRD Generator + Autonomous Agent
Generate atomic user stories from Linear tickets or descriptions, then execute them.

```bash
/ralph DEN-381        # generate PRD from Linear ticket
/ralph "Add auth"     # generate PRD from description
bun ralph 25          # run the agent loop (25 iterations max)
```

### `/dev-workflow` — Development Orchestration
End-to-end flow: Ticket → PRD → Ralph → Bug Bot loop → QA handoff.

## Setup

### Requirements

- [Bun](https://bun.sh)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — authenticated
- [GitHub CLI](https://cli.github.com/) (`gh`) — authenticated

### Install the skill

```bash
# Global (all projects)
ln -s /path/to/ralph ~/.claude/skills/ralph

# Per-project
ln -s /path/to/ralph .claude/skills/ralph
```

Add `.ralph/` to your project's `.gitignore`.

## Workflow

```
Ticket → /ralph TICKET-ID → bun ralph → Bug Bot fix loop → QA Review → Merge
```

1. **Ticket** — Linear ticket with full context
2. **PRD** — `/ralph TICKET-ID` generates atomic user stories
3. **Ralph** — `bun ralph 25` implements and opens PR
4. **Bug Bot** — Cursor Bug Bot reviews, fix comments with another Ralph loop
5. **QA** — Move to QA Review, assign reviewer
6. **Merge** — Reviewer merges

## Repo Structure

```
ralph/              # PRD skill + agent loop
  SKILL.md          # Claude Code skill (PRD generation)
  scripts/
    ralph.js        # Autonomous agent loop
dev-workflow/       # Orchestration workflow
  SKILL.md
  references/
    prd-format.md
```
