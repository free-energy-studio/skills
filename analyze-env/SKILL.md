---
name: analyze-env
description: Use when analyzing a production or deployed environment with agent-scoped environment variables, read-only database queries, logs, metrics, DNS, server state, provider APIs, or runtime evidence.
---

# Analyze Env

## Core Contract

Use this skill to materialize analysis credentials and inspect an environment. Database access must go through `scripts/query`, which enforces read-only PostgreSQL queries. Writes are prohibited unless the user explicitly confirms the exact write operation.

## Workflow

1. From the target project, create or use the project-local agent template and load the agent environment:
   ```bash
   eval "$(/path/to/analyze-env/scripts/sync --project . --op-vault ProdVault --op-item 'Prod Env' --force --print-source)"
   ```
   If `.env.agent.tpl` is missing, `sync` creates a minimal database-focused template by scanning `.env.example`, `.env.sample`, `.env.defaults`, code references such as `process.env.NAME`, and available 1Password item fields. It then writes `.env.agent` and prints source commands. Prefer passing `--op-vault` and `--op-item` on the first run; `sync` stores those as `ANALYZE_ENV_OP_VAULT` and `ANALYZE_ENV_OP_ITEM` in `.env.agent.tpl` for later runs. Args override shell env vars, and shell env vars override template values.
2. Scope the question before touching prod: time window, resource ID, user/customer ID, request ID, table set, log filter, DNS name, or provider/service.
3. Query databases only through `scripts/query`. Use `--url-env DATABASE_URL` or another discovered variable when the project does not use `PROD_DATABASE_URL`. Do not connect with raw database URLs, ORM consoles, migration tools, or ad hoc `psql` commands for analysis.
4. For logs, server state, DNS, metrics, and provider APIs, choose the narrowest read-only command or API based on available env vars, project code, and installed CLIs. Do not restart services, redeploy, mutate DNS, write files, clear caches, rotate logs, run migrations, or change provider config without explicit user confirmation.
5. Report findings with evidence: time window, query or command intent, row counts, relevant redacted snippets, confidence, and residual risk.

## Query Rules

- `scripts/query` reads `PROD_DATABASE_URL` by default and supports `--url-env` for another PostgreSQL URL variable.
- Run `scripts/query --dry-run ...` before the first query when changing URL variables, timeout settings, or query shape.
- Keep queries bounded: select explicit columns, add `LIMIT`, filter by indexed IDs or timestamps, and use `--timeout-ms` or `ANALYZE_ENV_STATEMENT_TIMEOUT_MS` when the default is not appropriate.
- Use `EXPLAIN` before heavy queries. Use `EXPLAIN ANALYZE` only when runtime evidence is necessary and the query is narrowly scoped.
- If `scripts/query` rejects SQL, treat that as a stop condition. Revise the query or ask for explicit user confirmation before using any separate write-capable tooling.

Example:

```bash
scripts/query --dry-run -c "select now(), current_database();"
scripts/query -c "select id, status, created_at from jobs where created_at > now() - interval '1 hour' limit 50;"
```

## Env Hints

The project-local `.env.agent.tpl` is the source of truth for analysis credentials. Keep it minimal: database connection variables are the only defaults. Add provider, log, DNS, server, or metrics env vars only when the current investigation needs them and the project or user provides a concrete source. Prefer project code and available env vars over assumptions.

Optional examples to add only when relevant:

```bash
RENDER_API_KEY='op://Vault/Item/RENDER_API_KEY'
RENDER_SERVICE_ID='srv-...'
CLOUDFLARE_API_TOKEN='op://Vault/Item/CLOUDFLARE_API_TOKEN'
CLOUDFLARE_ZONE_ID='op://Vault/Item/CLOUDFLARE_ZONE_ID'
PROD_LOGS_ENDPOINT='https://logs.example.com'
PROD_LOGS_TOKEN='op://Vault/Item/PROD_LOGS_TOKEN'
```

Treat these as examples, not required variables. If an env var is absent, inspect the project and available credentials before deciding whether that service should be profiled.

## Maintenance

After editing bundled scripts, run:

```bash
scripts/self_test.sh
```
