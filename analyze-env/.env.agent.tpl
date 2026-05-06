# Create a local agent environment with:
#   scripts/sync
#
# Do not commit .env.agent or paste injected values into chat.

# Prefer scripts/sync --op-vault/--op-item. These optional fallbacks are useful
# only when running sync repeatedly in the same shell. Prefer 1Password IDs when
# display names are ambiguous.
ANALYZE_ENV_OP_VAULT='{{ANALYZE_ENV_OP_VAULT}}'
ANALYZE_ENV_OP_ITEM='{{ANALYZE_ENV_OP_ITEM}}'

# Database analysis. scripts/query reads this by default and adds read-only
# PostgreSQL session options before connecting.
PROD_DATABASE_URL='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/prod database url'

# Query guardrails.
ANALYZE_ENV_STATEMENT_TIMEOUT_MS='60000'
ANALYZE_ENV_IDLE_TX_TIMEOUT_MS='60000'
ANALYZE_ENV_MAX_ROWS='200'

# General environment context.
PROD_APP_BASE_URL='https://[TODO prod app host]'
PROD_SERVICE_PROVIDER='[TODO render|fly|aws|gcp|azure|vercel|other]'
PROD_SERVICE_ID='[TODO service id]'
ANALYZE_ENV_OUTPUT_DIR='./.agent-profile'

# Optional server access hints. Prefer read-only commands and provider APIs.
PROD_SERVER_HOST='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/server host'
PROD_SERVER_USER='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/server user'

# Optional logs and metrics hints.
PROD_LOGS_ENDPOINT='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/logs endpoint'
PROD_LOGS_TOKEN='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/logs token'
PROD_METRICS_ENDPOINT='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/metrics endpoint'
PROD_METRICS_TOKEN='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/metrics token'

# Optional DNS/provider hints.
PROD_DNS_PROVIDER='[TODO cloudflare|route53|other]'
PROD_DNS_ZONE='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/dns zone'
RENDER_API_KEY='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/Render API key'
RENDER_SERVICE_ID='[TODO Render service id]'
