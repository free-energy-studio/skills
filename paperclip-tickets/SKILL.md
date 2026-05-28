---
name: paperclip-tickets
description: Create Paperclip tickets from an agent or local machine by authenticating to a Paperclip VPS, discovering company/project/agent IDs dynamically, and calling the issue creation API. Use when asked to create, file, open, list, or assign Paperclip issues/tickets/tasks from outside the Paperclip UI.
---

# Paperclip Tickets

Use this skill to create Paperclip issues from a local agent or external machine.

Do not hard-code company, project, or agent UUIDs. Discover them at runtime from the API by name, then create the issue.

## Required Inputs

Expect or derive:

- `PAPERCLIP_BASE_URL`, for example `https://paperclip.example.com`
- `PAPERCLIP_TOKEN`, a board API bearer token
- company name or company ID
- ticket title
- optional description, project name, assignee agent name, priority, work mode

Never print `PAPERCLIP_TOKEN`.

## Authentication

Use a board API token:

```bash
Authorization: Bearer $PAPERCLIP_TOKEN
```

If no token exists, create one using Paperclip CLI auth:

1. `POST /api/cli-auth/challenges`
2. Open the returned `approvalUrl` in a browser and approve it as a signed-in Paperclip user.
3. Store the returned `boardApiToken` locally as `PAPERCLIP_TOKEN`.

Challenge request:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/cli-auth/challenges" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "paperclip-ticket",
    "clientName": "local-agent",
    "requestedAccess": "board"
  }'
```

Poll challenge status:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/cli-auth/challenges/$CHALLENGE_ID?token=$CHALLENGE_SECRET"
```

Validate current token:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/cli-auth/me" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN"
```

Board API keys may expire; rerun the approval flow if requests return `401` or access disappears.

## Discovery Endpoints

Discover companies:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/companies" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN"
```

Choose a company by exact case-insensitive `name` match unless the user provided an ID.

Discover projects for a company:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/companies/$COMPANY_ID/projects" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN"
```

Choose a project by exact case-insensitive `name` match unless the user provided an ID. If no project is requested, omit `projectId`.

Discover agents for a company:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN"
```

Choose an assignee by exact case-insensitive `name` match unless the user provided an ID. If no assignee is requested, omit `assigneeAgentId`.

Optional issue lookup:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/companies/$COMPANY_ID/issues?limit=50" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN"
```

Use this when creating a child issue, linking dependencies, or inheriting an execution workspace from an existing issue.

## Create Ticket

Endpoint:

```text
POST /api/companies/:companyId/issues
```

Minimal payload:

```json
{
  "title": "Ticket title",
  "description": "Ticket details"
}
```

Common payload:

```json
{
  "projectId": "resolved-project-id",
  "title": "Ticket title",
  "description": "Ticket details",
  "priority": "medium",
  "workMode": "standard",
  "assigneeAgentId": "resolved-agent-id"
}
```

Valid priorities are usually:

```text
low, medium, high, urgent
```

Valid work modes include:

```text
standard, planning
```

If `status` is omitted, Paperclip defaults assigned issues to `todo` and unassigned issues to `backlog`.

Create with curl:

```bash
curl -sS "$PAPERCLIP_BASE_URL/api/companies/$COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ISSUE_JSON"
```

## Workflow

1. Validate `PAPERCLIP_BASE_URL` and `PAPERCLIP_TOKEN`.
2. Call `/api/cli-auth/me`; stop if unauthorized.
3. Call `/api/companies`; resolve company.
4. If project was requested, call `/api/companies/:companyId/projects`; resolve project.
5. If assignee was requested, call `/api/companies/:companyId/agents`; resolve agent.
6. Build issue JSON. Include only fields you know are valid.
7. POST to `/api/companies/:companyId/issues`.
8. Report the returned issue identifier, title, status, and URL if present or derivable.

## Resolution Rules

- Prefer exact case-insensitive name matches.
- If multiple matches exist, ask the user to disambiguate.
- If no match exists, show available names and stop.
- Do not invent UUIDs.
- Do not store or display bearer tokens in issue descriptions, comments, logs, or final output.

## URL Construction

If the API response includes `identifier`, the browser URL is commonly:

```text
$PAPERCLIP_BASE_URL/<company-prefix>/issues/<identifier>
```

If the company prefix is unknown, report the issue ID and identifier instead of guessing.

## Optional Fields

Use only when explicitly requested or clearly needed:

```json
{
  "goalId": "resolved-goal-id",
  "parentId": "existing-parent-issue-id",
  "blockedByIssueIds": ["existing-issue-id"],
  "inheritExecutionWorkspaceFromIssueId": "existing-issue-id",
  "executionWorkspacePreference": "isolated_workspace",
  "labelIds": ["resolved-label-id"]
}
```

For parent/dependency/workspace inheritance, first query existing issues and resolve real issue IDs.
