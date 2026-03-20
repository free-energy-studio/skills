---
name: twilio
description: "Twilio operations via the `twilio` CLI: profile/auth setup, SMS and MMS, voice calls, phone numbers, messaging services, and general Twilio API access from the terminal. Use when sending test texts, placing or inspecting calls, listing or filtering Twilio numbers, checking account resources, or scripting Twilio workflows without using the web console. NOT for: building full webhook apps or TwiML servers from scratch (use coding tools), or browser-only console tasks."
---

# Twilio CLI (`twilio`)

Use the Twilio CLI for direct terminal access to Twilio accounts and resources.

## Requirements

- Verify the CLI is installed: `twilio --version`
- Authenticate with either:
  - `twilio login`
  - `twilio profiles:create ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx --auth-token YOUR_AUTH_TOKEN --profile default`

## Operating Rules

- Prefer `-o json` for machine-readable output.
- Use `-p <profile>` when multiple Twilio accounts or subaccounts are configured.
- Use `--account-sid <AC...>` when you need to target a specific subaccount explicitly.
- Use `--properties` to reduce noisy list output.
- Run `twilio <command> --help` before guessing flags or field names.

## Common Workflows

### Profiles and auth

```bash
twilio profiles:list
twilio profiles:use default
twilio login ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx --auth-token YOUR_AUTH_TOKEN --profile work
```

### Phone numbers

```bash
twilio phone-numbers:list

twilio api:core:incoming-phone-numbers:list -o json
```

### SMS / MMS

```bash
twilio api:core:messages:create \
  --from +15551234567 \
  --to +15557654321 \
  --body 'Hello from Twilio CLI'

twilio api:core:messages:list --limit 20 -o json
```

### Calls

```bash
twilio api:core:calls:create \
  --from +15551234567 \
  --to +15557654321 \
  --url https://demo.twilio.com/docs/voice.xml

twilio api:core:calls:list --limit 20 -o json
```

### Messaging services

```bash
twilio api:messaging:v1:services:list -o json
```

## Command Shape

Most Twilio API commands follow this pattern:

```bash
twilio api:<product>:<version>:<resource>:<action> [flags]
```

Examples:

- `twilio api:core:messages:create`
- `twilio api:core:messages:list`
- `twilio api:core:calls:create`
- `twilio api:messaging:v1:services:list`

## Troubleshooting

- **Auth errors / 401 / 403** → recreate or switch profiles with `twilio profiles:list`, `twilio profiles:use`, or `twilio login`.
- **Wrong account data** → confirm the active profile and `--account-sid`.
- **Need exact flags** → run the specific command with `--help`; Twilio CLI help is detailed and usually faster than searching docs.
- **Need quieter automation** → use `-l error -o json` or `--silent` when appropriate.

For more concrete examples and reusable command patterns, read `references/command-cookbook.md`.
