# GWS API Patterns Reference

## Table of Contents

1. [Gmail Raw API](#gmail-raw-api)
2. [Drive Raw API](#drive-raw-api)
3. [Calendar Raw API](#calendar-raw-api)
4. [Sheets Raw API](#sheets-raw-api)
5. [Docs Raw API](#docs-raw-api)
6. [Tasks Raw API](#tasks-raw-api)
7. [Drive Query Syntax](#drive-query-syntax)
8. [Gmail Query Syntax](#gmail-query-syntax)
9. [Pagination](#pagination)
10. [File Upload & Download](#file-upload--download)
11. [Permissions & Sharing](#permissions--sharing)
12. [Environment Variables](#environment-variables)

## Gmail Raw API

```bash
# List messages
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'
gws gmail users messages list --params '{"userId": "me", "q": "is:unread", "maxResults": 5}'

# Get message (full, metadata, or minimal)
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "full"}'
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]}'

# Modify labels
gws gmail users messages modify --params '{"userId": "me", "id": "MSG_ID"}' \
  --json '{"addLabelIds": ["STARRED"], "removeLabelIds": ["UNREAD"]}'

# Trash / Untrash
gws gmail users messages trash --params '{"userId": "me", "id": "MSG_ID"}'
gws gmail users messages untrash --params '{"userId": "me", "id": "MSG_ID"}'

# List labels
gws gmail users labels list --params '{"userId": "me"}'

# Create label
gws gmail users labels create --params '{"userId": "me"}' \
  --json '{"name": "MyLabel", "labelListVisibility": "labelShow", "messageListVisibility": "show"}'

# List drafts
gws gmail users drafts list --params '{"userId": "me"}'

# Get thread
gws gmail users threads get --params '{"userId": "me", "id": "THREAD_ID"}'
```

## Drive Raw API

```bash
# List files with fields
gws drive files list --params '{"pageSize": 20, "fields": "files(id,name,mimeType,modifiedTime,size,owners)"}'

# Get file metadata
gws drive files get --params '{"fileId": "FILE_ID", "fields": "id,name,mimeType,modifiedTime,size,webViewLink"}'

# Download file content
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' --output ./downloaded-file.ext

# Export Google Docs format to other formats
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' --output ./doc.pdf
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' --output ./sheet.csv

# Create file with upload
gws drive files create --json '{"name": "report.pdf"}' --upload ./report.pdf

# Create file in folder
gws drive files create --json '{"name": "notes.txt", "parents": ["FOLDER_ID"]}' --upload ./notes.txt

# Update (patch) file metadata
gws drive files update --params '{"fileId": "FILE_ID"}' --json '{"name": "New Name"}'

# Move file to folder
gws drive files update --params '{"fileId": "FILE_ID", "addParents": "FOLDER_ID", "removeParents": "OLD_FOLDER_ID"}'

# Copy file
gws drive files copy --params '{"fileId": "FILE_ID"}' --json '{"name": "Copy of File"}'

# Create folder
gws drive files create --json '{"name": "Folder Name", "mimeType": "application/vnd.google-apps.folder"}'

# Create subfolder
gws drive files create --json '{"name": "Subfolder", "mimeType": "application/vnd.google-apps.folder", "parents": ["PARENT_FOLDER_ID"]}'
```

## Calendar Raw API

```bash
# List events
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10, "timeMin": "2026-01-01T00:00:00Z", "singleEvents": true, "orderBy": "startTime"}'

# Get event
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'

# Create event (raw)
gws calendar events insert --params '{"calendarId": "primary"}' --json '{
  "summary": "Team Meeting",
  "location": "Conference Room",
  "description": "Weekly sync",
  "start": {"dateTime": "2026-06-17T09:00:00-07:00"},
  "end": {"dateTime": "2026-06-17T10:00:00-07:00"},
  "attendees": [{"email": "alice@example.com"}],
  "conferenceData": {"createRequest": {"requestId": "unique-id"}}
}'

# Update event
gws calendar events update --params '{"calendarId": "primary", "eventId": "EVENT_ID"}' \
  --json '{"summary": "Updated Title"}'

# Delete event
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'

# List calendars
gws calendar calendarList list
```

## Sheets Raw API

```bash
# Get spreadsheet metadata
gws sheets spreadsheets get --params '{"spreadsheetId": "SHEET_ID"}'

# Read values
gws sheets spreadsheets values get --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1:C10"}'

# Write values
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95], ["Bob", 87]]}'

# Append values
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Charlie", 92]]}'

# Clear values
gws sheets spreadsheets values clear \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1:C10"}'

# Batch get (multiple ranges)
gws sheets spreadsheets values batchGet \
  --params '{"spreadsheetId": "SHEET_ID", "ranges": ["Sheet1!A1:B5", "Sheet2!A1:D3"]}'

# Create spreadsheet
gws sheets spreadsheets create --json '{"properties": {"title": "New Sheet"}}'
```

## Docs Raw API

```bash
# Get document content
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Create document
gws docs documents create --json '{"title": "New Document"}'

# Batch update (insert text at end)
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' --json '{
  "requests": [{"insertText": {"location": {"index": 1}, "text": "Hello World\n"}}]
}'
```

## Tasks Raw API

```bash
# List task lists
gws tasks tasklists list

# List tasks
gws tasks tasks list --params '{"tasklist": "@default"}'

# Create task
gws tasks tasks insert --params '{"tasklist": "@default"}' \
  --json '{"title": "Review PR", "notes": "Check the latest changes", "due": "2026-03-25T00:00:00Z"}'

# Complete task
gws tasks tasks update --params '{"tasklist": "@default", "task": "TASK_ID"}' \
  --json '{"status": "completed"}'

# Delete task
gws tasks tasks delete --params '{"tasklist": "@default", "task": "TASK_ID"}'
```

## Drive Query Syntax

The `q` parameter in `drive files list` supports:

| Operator | Example |
|----------|---------|
| `name contains` | `"name contains 'report'"` |
| `name =` | `"name = 'exact.pdf'"` |
| `mimeType =` | `"mimeType = 'application/pdf'"` |
| `in parents` | `"'FOLDER_ID' in parents"` |
| `trashed =` | `"trashed = false"` |
| `modifiedTime >` | `"modifiedTime > '2026-01-01T00:00:00'"` |
| `fullText contains` | `"fullText contains 'quarterly'"` |
| `sharedWithMe` | `"sharedWithMe = true"` |
| `starred` | `"starred = true"` |

Combine with `and`: `"mimeType = 'application/pdf' and name contains 'invoice'"`

### Common MIME Types

- Folder: `application/vnd.google-apps.folder`
- Google Doc: `application/vnd.google-apps.document`
- Google Sheet: `application/vnd.google-apps.spreadsheet`
- Google Slides: `application/vnd.google-apps.presentation`
- PDF: `application/pdf`

## Gmail Query Syntax

Same as Gmail search box:

| Filter | Example |
|--------|---------|
| From | `from:alice@example.com` |
| To | `to:bob@example.com` |
| Subject | `subject:invoice` |
| Has attachment | `has:attachment` |
| Date range | `after:2026/01/01 before:2026/02/01` |
| Label | `label:important` |
| Unread | `is:unread` |
| Starred | `is:starred` |
| Combined | `from:boss subject:urgent is:unread` |

## Pagination

```bash
# Auto-paginate all results
gws drive files list --params '{"pageSize": 100}' --page-all

# Limit pages
gws drive files list --params '{"pageSize": 100}' --page-all --page-limit 5

# Add delay between pages (rate limiting)
gws drive files list --params '{"pageSize": 100}' --page-all --page-delay 500
```

Output is NDJSON — one JSON object per page. Pipe to `jq` for processing:
```bash
gws drive files list --params '{"pageSize": 100}' --page-all | jq -r '.files[].name'
```

## File Upload & Download

```bash
# Upload with helper
gws drive +upload ./file.pdf --name 'Report' --parent FOLDER_ID

# Upload with raw API (more control)
gws drive files create --json '{"name": "file.pdf", "parents": ["FOLDER_ID"]}' --upload ./file.pdf

# Upload with explicit MIME type
gws drive files create --json '{"name": "data.csv"}' --upload ./data.csv --upload-content-type text/csv

# Download binary file
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' --output ./downloaded.pdf

# Export Google format to standard format
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' --output ./doc.pdf
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "text/plain"}' --output ./doc.txt
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "text/csv"}' --output ./data.csv
```

## Permissions & Sharing

```bash
# List permissions
gws drive permissions list --params '{"fileId": "FILE_ID"}'

# Share with user
gws drive permissions create --params '{"fileId": "FILE_ID"}' \
  --json '{"role": "writer", "type": "user", "emailAddress": "alice@example.com"}'

# Share with anyone (link sharing)
gws drive permissions create --params '{"fileId": "FILE_ID"}' \
  --json '{"role": "reader", "type": "anyone"}'

# Remove permission
gws drive permissions delete --params '{"fileId": "FILE_ID", "permissionId": "PERM_ID"}'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Pre-obtained OAuth2 access token (highest priority) |
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path to OAuth credentials JSON |
| `GOOGLE_WORKSPACE_CLI_CLIENT_ID` | OAuth client ID |
| `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Config directory (default: `~/.config/gws`) |
| `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND` | `keyring` (default) or `file` |
| `GOOGLE_WORKSPACE_CLI_LOG` | Log level (e.g. `gws=debug`) |
| `GOOGLE_WORKSPACE_PROJECT_ID` | GCP project ID override |
