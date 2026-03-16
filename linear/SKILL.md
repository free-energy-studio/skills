---
name: linear
description: "Query and manage Linear issues, cycles, labels, documents, attachments, projects, and team workflows. Use when creating, updating, searching, or triaging Linear issues, managing sprints, checking project status, or running a standup summary."
metadata:
  {
    "openclaw":
      {
        "emoji": "📐",
        "requires": { "env": ["LINEAR_API_KEY"] },
      },
  }
---

# Linear

Manage issues, cycles, labels, documents, attachments, and projects via the official `@linear/sdk`.

Default team: **DOMA** (set via `LINEAR_DEFAULT_TEAM` env var).

## Run

```bash
bun {baseDir}/scripts/linear.ts <command> [args]
```

## Issues

```bash
# Browse
bun {baseDir}/scripts/linear.ts my-issues
bun {baseDir}/scripts/linear.ts team [TEAM_KEY]
bun {baseDir}/scripts/linear.ts issue DOMA-123
bun {baseDir}/scripts/linear.ts search "auth bug"

# Create (supports flags for priority, status, assignee, label, due date)
bun {baseDir}/scripts/linear.ts create "Title" "Description"
bun {baseDir}/scripts/linear.ts create "Title" "Description" --priority high --status todo --assignee Sam --label Bug --due 2026-04-01

# Update (all fields via flags)
bun {baseDir}/scripts/linear.ts update DOMA-123 --title "New title" --description "Full desc" --priority high --status progress --assignee Sam --label Feature --due 2026-04-01

# Quick actions
bun {baseDir}/scripts/linear.ts comment DOMA-123 "Comment text"
bun {baseDir}/scripts/linear.ts status DOMA-123 progress
bun {baseDir}/scripts/linear.ts priority DOMA-123 high
bun {baseDir}/scripts/linear.ts assign DOMA-123 Sam

# Lifecycle
bun {baseDir}/scripts/linear.ts archive DOMA-123
bun {baseDir}/scripts/linear.ts unarchive DOMA-123
bun {baseDir}/scripts/linear.ts delete DOMA-123

# Relations
bun {baseDir}/scripts/linear.ts relate DOMA-123 DOMA-456 blocks
bun {baseDir}/scripts/linear.ts relate DOMA-123 DOMA-456 relates-to
bun {baseDir}/scripts/linear.ts relate DOMA-123 DOMA-456 duplicates

# Batch create from JSON array or file path
bun {baseDir}/scripts/linear.ts batch-create '[{"title":"Issue 1","priority":"high"},{"title":"Issue 2","assignee":"Sam"}]' --team DOMA
bun {baseDir}/scripts/linear.ts batch-create issues.json --team DOMA
```

## Cycles

```bash
# List cycles for a team
bun {baseDir}/scripts/linear.ts cycles [TEAM_KEY]

# Show current active cycle with all its issues
bun {baseDir}/scripts/linear.ts cycle-current [TEAM_KEY]
```

## Labels

```bash
# List labels (workspace-wide or team-scoped)
bun {baseDir}/scripts/linear.ts labels
bun {baseDir}/scripts/linear.ts labels DOMA

# Create a label
bun {baseDir}/scripts/linear.ts label-create "Bug" --color "#ff0000" --description "Software defect" --team DOMA
```

## Documents

```bash
# List documents
bun {baseDir}/scripts/linear.ts docs

# View a document (by UUID)
bun {baseDir}/scripts/linear.ts doc <DOC_ID>

# Create a document
bun {baseDir}/scripts/linear.ts doc-create "Architecture Notes" --content "## Overview\n\nDetails here..." --project <PROJECT_ID>
```

## Attachments

```bash
# List attachments on an issue
bun {baseDir}/scripts/linear.ts attachments DOMA-123

# Add an attachment
bun {baseDir}/scripts/linear.ts attach DOMA-123 "Design mockup" "https://figma.com/..." --subtitle "Homepage redesign"
```

## Teams & Projects

```bash
bun {baseDir}/scripts/linear.ts teams
bun {baseDir}/scripts/linear.ts projects [TEAM_KEY]
bun {baseDir}/scripts/linear.ts standup
```

## Status values
`todo` · `progress` (In Progress) · `in-progress` · `review` (In Review) · `in-review` · `done` · `blocked` · `backlog` · `cancelled` · `canceled`

## Priority values
`urgent` · `high` · `medium` · `low` · `none`

## Relation types
`blocks` · `relates-to` · `duplicates`

## Notes
- `issue` detail view shows labels, relations, attachments, and comments
- `create` and `update` support `--priority`, `--status`, `--assignee`, `--label`, `--due` flags
- `update` supports multiple flags in one call
- `search` does full-text search across all issues
- `batch-create` accepts inline JSON string or a file path, with caching for user/label/state lookups
- `delete` is permanent — use `archive` for reversible removal
- Documents use UUIDs, not team identifiers
