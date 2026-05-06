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
   If `.env.agent.tpl` is missing, `sync` creates it by scanning `.env.example`, `.env.sample`, `.env.defaults`, and code references such as `process.env.NAME` and `import.meta.env.NAME`. It then writes `.env.agent` and prints source commands. `sync` also accepts `PROD_PROFILE_OP_VAULT` and `PROD_PROFILE_OP_ITEM` from the environment.
2. Scope the question before touching prod: time window, resource ID, user/customer ID, request ID, table set, log filter, DNS name, or provider/service.
3. Query databases only through `scripts/query`. Use `--url-env DATABASE_URL` or another discovered variable when the project does not use `PROD_DATABASE_URL`. Do not connect with raw database URLs, ORM consoles, migration tools, or ad hoc `psql` commands for analysis.
4. For logs, server state, DNS, metrics, and provider APIs, choose the narrowest read-only command or API based on available env vars, project code, and installed CLIs. Do not restart services, redeploy, mutate DNS, write files, clear caches, rotate logs, run migrations, or change provider config without explicit user confirmation.
5. Report findings with evidence: time window, query or command intent, row counts, relevant redacted snippets, confidence, and residual risk.

## Query Rules

- `scripts/query` reads `PROD_DATABASE_URL` by default and supports `--url-env` for another PostgreSQL URL variable.
- Run `scripts/query --dry-run ...` before the first query when changing URL variables, timeout settings, or query shape.
- Keep queries bounded: select explicit columns, add `LIMIT`, filter by indexed IDs or timestamps, and use `PROD_PROFILE_STATEMENT_TIMEOUT_MS`.
- Use `EXPLAIN` before heavy queries. Use `EXPLAIN ANALYZE` only when runtime evidence is necessary and the query is narrowly scoped.
- If `scripts/query` rejects SQL, treat that as a stop condition. Revise the query or ask for explicit user confirmation before using any separate write-capable tooling.

Example:

```bash
scripts/query --dry-run -c "select now(), current_database();"
scripts/query -c "select id, status, created_at from jobs where created_at > now() - interval '1 hour' limit 50;"
```

## Env Hints

The project-local `.env.agent.tpl` is the source of truth for analysis credentials. The bundled `.env.agent.tpl` is only a fallback/example for projects where scanning does not find enough context. Treat non-database env vars as hints for what else to inspect, not as a mandatory checklist. Prefer project code and available env vars over assumptions.

## Maintenance

After editing bundled scripts, run:

```bash
scripts/self_test.sh
```
