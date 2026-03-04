---
name: ralph
description: Generate a PRD (Product Requirements Document) from a Linear ticket ID or description. Use when starting work on a feature, bug fix, or any development task. Triggers on ticket IDs (e.g. DEN-381, LIN-123) or descriptions like "Add user auth".
---

# PRD Builder for Ralph

Generate atomic user stories from a Linear ticket or description, outputting `.ralph/prd.json`.

## Input Handling

The user will provide either:
1. A Linear ticket ID (e.g., "LIN-123" or just "123")
2. A direct description as a string

## Process

### Phase 1: Clean Up Existing Files

Before generating a new PRD, check for existing files:

1. Check if `.ralph/prd.json` exists
2. Check if `.ralph/progress.txt` exists

If either file exists:
- Delete both files (they are a pair and should be regenerated together)
- Inform the user that existing PRD/progress files were removed
- Proceed with fresh generation

### Phase 2: Determine Input Type

Check if the input looks like a Linear ticket ID:
- Matches pattern: `LIN-\d+` or `[A-Z]+-\d+` or just `\d+`
- If yes, fetch the Linear ticket using `mcp__plugin_linear_linear__get_issue`
- Extract: Title, Description, Acceptance criteria, Labels, Project, **Git branch name**
- Use the Linear-provided git branch name as the `branchName` in the PRD
- If no, treat it as a direct description and generate a branch name like `ralph/[feature-name]`

### Phase 3: Discovery

1. **Understand the request** - What feature/fix is being requested?
2. **Explore the codebase** - Find relevant files, patterns, and existing implementations
3. **Ask clarifying questions** if scope is ambiguous

### Phase 4: Architecture

1. **Identify affected areas** - schemas, domain logic, API handlers, routes, components
2. **Map dependencies** - What needs to be built first?

### Phase 5: Story Breakdown

**CRITICAL: Stories must be ATOMIC**

- **Single responsibility** - One thing only
- **Independently verifiable** - Can run typecheck after completion
- **Small** - 1-3 files to change
- **Clear acceptance criteria** - Specific, testable conditions

BAD: `"Implement calendar syncing feature"` → too big

GOOD:
```json
{
  "title": "Add calendarEvents table schema",
  "acceptanceCriteria": [
    "Create `packages/core/src/calendar/calendar.sql.ts`",
    "Define pgTable with: id, organizationId, teamId, title, startTime, endTime, externalId",
    "Export Zod schema using drizzle-zod",
    "Typecheck passes"
  ]
}
```

### Phase 6: Generate PRD

Write `.ralph/prd.json`:

```json
{
  "branchName": "[Linear git branch name OR ralph/feature-name]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Concise action: verb + noun]",
      "acceptanceCriteria": ["..."],
      "priority": 1,
      "passes": false,
      "notes": "Optional context for Ralph"
    }
  ]
}
```

### Phase 7: Summary

1. Overall approach
2. Story ordering rationale
3. Assumptions made
4. Story count with IDs and titles
5. Next steps: `bun ralph 25`

## Ordering Rules

1. Database first → domain logic → API handlers → frontend
2. Types/schemas before implementation
3. Happy path before edge cases

## Error Handling

- Linear ticket not found → ask user to verify ID
- Description too vague → ask clarifying questions
- Existing prd.json/progress.txt → auto-remove and inform user
