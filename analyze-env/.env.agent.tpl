# Minimal agent environment. Do not commit .env.agent or paste injected values
# into chat. Prefer passing scripts/sync --op-vault/--op-item rather than
# exporting ANALYZE_ENV_OP_VAULT or ANALYZE_ENV_OP_ITEM.

# scripts/query reads PROD_DATABASE_URL by default and adds read-only PostgreSQL
# session options before connecting.
PROD_DATABASE_URL='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/prod database url'

# Add other read-only analysis env vars only when the current investigation
# needs them, for example provider API keys, service IDs, log endpoints, or DNS
# zone IDs.
