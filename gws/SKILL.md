---
name: gws
description: |
  Google Workspace operations via the `gws` CLI: Gmail, Drive, Calendar, Sheets, Docs, Slides, Tasks, and cross-service workflows. Use when: (1) reading, sending, replying to, or forwarding email, (2) listing, uploading, or managing Drive files/folders, (3) checking calendar agenda or creating events, (4) reading or writing spreadsheets, (5) reading or appending to Google Docs, (6) checking inbox/triage, (7) standup reports, meeting prep, weekly digests, or email-to-task conversion, (8) any Google Workspace data access. Triggers on: "check my email", "send an email", "what's on my calendar", "create an event", "list my Drive files", "upload to Drive", "read the spreadsheet", "append to the doc", "standup report", "meeting prep", "weekly digest". NOT for: Google Cloud infra (use gcloud), non-Workspace APIs, or browser-based Workspace UI tasks.
---

# Google Workspace CLI (`gws`)

One CLI for all of Google Workspace. Dynamically built from Google Discovery Service — commands update automatically when APIs change. All output is structured JSON.

## Prerequisites

Verify auth: `gws gmail +triage --max 1`. If exit code 2 → auth missing, run `gws auth login`.

## Command Pattern

```
gws <service> <resource> <method> [--params JSON] [--json JSON] [flags]
```

- `--params` → URL/query parameters as JSON
- `--json` → request body as JSON (POST/PATCH/PUT)
- `--upload <PATH>` → file upload (multipart, auto-detects MIME)
- `--output <PATH>` → save binary response to file
- `--format <FMT>` → json (default), table, yaml, csv
- `--page-all` → auto-paginate (NDJSON, one JSON per page)
- `--page-limit <N>` → max pages (default 10)
- `--dry-run` → preview request without executing

## Services

drive, gmail, calendar, sheets, docs, slides, tasks, people, chat, classroom, forms, keep, meet, events, workflow

## Helper Commands (preferred)

Helpers are prefixed with `+` and handle boilerplate (threading, encoding, metadata). **Always prefer helpers over raw API calls when available.**

### Gmail

```bash
# Triage inbox
gws gmail +triage                              # unread summary (table)
gws gmail +triage --max 5 --query 'from:boss'  # filtered

# Read a message
gws gmail +read --id MSG_ID                    # plain text body
gws gmail +read --id MSG_ID --headers          # include From/To/Subject/Date

# Send
gws gmail +send --to alice@example.com --subject 'Hello' --body 'Hi there'
gws gmail +send --to a@x.com --subject 'Report' --body 'Attached' -a report.pdf
gws gmail +send --to a@x.com --subject 'Hi' --body '<b>Bold</b>' --html

# Reply / Reply-all / Forward
gws gmail +reply --message-id MSG_ID --body 'Thanks!'
gws gmail +reply-all --message-id MSG_ID --body 'Noted'
gws gmail +forward --message-id MSG_ID --to dave@example.com --body 'FYI'
```

### Calendar

```bash
# View agenda
gws calendar +agenda                   # upcoming events (account timezone)
gws calendar +agenda --today           # today only
gws calendar +agenda --week            # this week
gws calendar +agenda --days 3          # next 3 days
gws calendar +agenda --timezone America/New_York

# Create event
gws calendar +insert --summary 'Standup' \
  --start '2026-06-17T09:00:00-07:00' --end '2026-06-17T09:30:00-07:00'
gws calendar +insert --summary 'Sync' \
  --start ... --end ... --attendee alice@x.com --meet
```

### Drive

```bash
# List files
gws drive files list --params '{"pageSize": 10}'
gws drive files list --params '{"q": "mimeType=\"application/vnd.google-apps.folder\"", "pageSize": 20}'

# Upload
gws drive +upload ./report.pdf
gws drive +upload ./report.pdf --parent FOLDER_ID --name 'Q1 Report'

# Download
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' --output ./file.pdf

# Create folder
gws drive files create --json '{"name": "New Folder", "mimeType": "application/vnd.google-apps.folder"}'

# Delete
gws drive files delete --params '{"fileId": "FILE_ID"}'
```

### Sheets

```bash
# Read
gws sheets +read --spreadsheet SHEET_ID --range 'Sheet1!A1:D10'

# Append row
gws sheets +append --spreadsheet SHEET_ID --values 'Alice,100,true'
gws sheets +append --spreadsheet SHEET_ID --json-values '[["a","b"],["c","d"]]'

# Create spreadsheet
gws sheets spreadsheets create --json '{"properties": {"title": "Budget"}}'
```

**⚠️ Shell quoting:** Sheets ranges use `!` — always wrap in single quotes to avoid bash history expansion.

### Docs

```bash
# Read document
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Append text
gws docs +write --document DOC_ID --text 'Hello, world!'
```

### Workflow (cross-service)

```bash
gws workflow +standup-report           # today's meetings + open tasks
gws workflow +meeting-prep             # next meeting: agenda, attendees, docs
gws workflow +email-to-task --message-id MSG_ID   # email → task
gws workflow +weekly-digest            # week's meetings + unread count
```

## Raw API Access

When no helper exists, use the raw Discovery API surface:

```bash
# Introspect any method schema
gws schema drive.files.list
gws schema gmail.users.messages.get

# Generic pattern
gws <service> <resource> <method> --params '{"key": "val"}' --json '{"body": "data"}'
```

Run `gws <service> --help` to see all resources and methods for a service.

## Common Patterns

### Pagination
```bash
gws drive files list --params '{"pageSize": 100}' --page-all --page-limit 50
```

### Search Drive
```bash
# Files by name
gws drive files list --params '{"q": "name contains \"report\"", "pageSize": 10}'

# Files in folder
gws drive files list --params '{"q": "\"FOLDER_ID\" in parents", "pageSize": 50}'

# By MIME type
gws drive files list --params '{"q": "mimeType=\"application/vnd.google-apps.spreadsheet\"", "pageSize": 10}'
```

### Gmail Search
```bash
gws gmail +triage --query 'from:alice@example.com after:2026/01/01'
gws gmail +triage --query 'subject:invoice has:attachment'
gws gmail users messages list --params '{"userId": "me", "q": "is:unread label:important", "maxResults": 5}'
```

### Send Email with Raw API (when +send is insufficient)
```bash
# Base64url-encode the RFC 5322 message
RAW=$(echo -e "From: me\nTo: x@y.com\nSubject: Hi\n\nBody" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
gws gmail users messages send --params '{"userId": "me"}' --json "{\"raw\": \"$RAW\"}"
```

## Exit Codes

- 0 → success
- 1 → API error (Google 4xx/5xx)
- 2 → auth error (missing/expired credentials)
- 3 → validation error (bad args)
- 4 → discovery error
- 5 → internal error

## Troubleshooting

- **403 insufficientPermissions** → re-auth with needed scopes: `gws auth login`
- **403 accessNotConfigured** → enable the API in GCP console (URL in error message)
- **Exit code 2** → run `gws auth login` to refresh credentials
- **"Using keyring backend: keyring"** on stderr → normal, ignore

For detailed API schemas and advanced usage, see `references/api-patterns.md`.
