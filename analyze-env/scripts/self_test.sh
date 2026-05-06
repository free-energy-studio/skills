#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'self_test.sh: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" == *"$needle"* ]] || fail "expected output to contain: $needle"
}

assert_success() {
  local description="$1"
  local output
  shift
  if ! output="$("$@" 2>&1)"; then
    printf '%s\n' "$output" >&2
    fail "expected success: $description"
  fi
}

assert_failure() {
  local description="$1"
  local output
  shift
  if output="$("$@" 2>&1)"; then
    printf '%s\n' "$output" >&2
    fail "expected failure: $description"
  fi
}

file_mode() {
  stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1"
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

export PROD_DATABASE_URL='postgres://user:secret@example.com:5432/app'
export ANALYZE_ENV_STATEMENT_TIMEOUT_MS='1000'
export ANALYZE_ENV_IDLE_TX_TIMEOUT_MS='1000'

db_dry_run="$("$ROOT/scripts/query" --dry-run -c "select id, created_at from jobs limit 5;")"
assert_contains "$db_dry_run" 'BEGIN READ ONLY;'
assert_contains "$db_dry_run" '[redacted]@example.com'
assert_contains "$db_dry_run" 'ROLLBACK;'

assert_failure \
  "db helper rejects writes" \
  "$ROOT/scripts/query" --dry-run -c "update users set name = 'x' where id = 1;"

assert_failure \
  "db helper rejects all copy statements" \
  "$ROOT/scripts/query" --dry-run -c "copy (select 1) to program 'cat';"

assert_failure \
  "db helper rejects side-effect functions" \
  "$ROOT/scripts/query" --dry-run -c "select pg_notify('events', 'payload');"

template="$tmp_dir/env.agent.tpl"
output="$tmp_dir/.env.agent"
printf "PROD_DATABASE_URL='postgres://user:secret@example.com:5432/app'\n" > "$template"

load_output="$("$ROOT/scripts/sync" --template "$template" --output "$output" --no-inject --print-source)"
[[ -f "$output" ]] || fail "expected prepared env file to exist"
[[ "$(file_mode "$output")" == "600" ]] || fail "expected env file mode 600"
assert_contains "$load_output" 'set -a'
assert_contains "$load_output" "$output"

op_template="$tmp_dir/env.op.tpl"
op_output="$tmp_dir/.env.op"
printf "PROD_DATABASE_URL='op://{{ANALYZE_ENV_OP_VAULT}}/{{ANALYZE_ENV_OP_ITEM}}/prod database url'\n" > "$op_template"

"$ROOT/scripts/sync" --template "$op_template" --output "$op_output" --no-inject --op-vault ProdVault --op-item 'Render Prod' >/dev/null
assert_contains "$(<"$op_output")" "op://ProdVault/Render Prod/prod database url"

ANALYZE_ENV_OP_VAULT=EnvVault ANALYZE_ENV_OP_ITEM=EnvItem \
  "$ROOT/scripts/sync" --template "$op_template" --output "$op_output" --no-inject --force >/dev/null
assert_contains "$(<"$op_output")" "op://EnvVault/EnvItem/prod database url"

assert_failure \
  "sync requires op item when template uses item placeholder" \
  "$ROOT/scripts/sync" --template "$op_template" --output "$tmp_dir/.env.missing" --no-inject --op-vault ProdVault

project_dir="$tmp_dir/project"
mkdir -p "$project_dir/src"
printf "DATABASE_URL=\nOPENAI_API_KEY=\n" > "$project_dir/.env.example"
printf "console.log(process.env.RENDER_API_KEY, import.meta.env.VITE_PUBLIC_URL);\n" > "$project_dir/src/app.ts"

project_source="$("$ROOT/scripts/sync" --project "$project_dir" --no-inject --op-vault Gibbs --op-item speechtank.env --print-source)"
[[ -f "$project_dir/.env.agent.tpl" ]] || fail "expected project .env.agent.tpl to be created"
[[ -f "$project_dir/.env.agent" ]] || fail "expected project .env.agent to be created"
assert_contains "$project_source" "$project_dir/.env.agent"
assert_contains "$(<"$project_dir/.env.agent.tpl")" "DATABASE_URL='op://Gibbs/speechtank.env/DATABASE_URL'"
assert_contains "$(<"$project_dir/.env.agent.tpl")" "OPENAI_API_KEY='op://Gibbs/speechtank.env/OPENAI_API_KEY'"
assert_contains "$(<"$project_dir/.env.agent.tpl")" "RENDER_API_KEY='op://Gibbs/speechtank.env/RENDER_API_KEY'"
assert_contains "$(<"$project_dir/.env.agent.tpl")" "VITE_PUBLIC_URL='op://Gibbs/speechtank.env/VITE_PUBLIC_URL'"
[[ "$(file_mode "$project_dir/.env.agent")" == "600" ]] || fail "expected project env file mode 600"

success_project_dir="$tmp_dir/success-project"
success_bin="$tmp_dir/success-bin"
mkdir -p "$success_project_dir/src" "$success_bin"
printf "OPENAI_API_KEY=\n" > "$success_project_dir/.env.example"
printf "console.log(process.env.RENDER_API_KEY);\n" > "$success_project_dir/src/app.ts"
cat > "$success_bin/op" <<'EOS'
#!/usr/bin/env bash
if [[ "$1" == "item" && "$2" == "get" ]]; then
  printf '{"fields":[{"label":"DATABASE_URL"}]}\n'
  exit 0
fi
if [[ "$1" == "read" ]]; then
  printf 'secret-value'
  exit 0
fi
exit 1
EOS
cat > "$success_bin/jq" <<'EOS'
#!/usr/bin/env bash
cat >/dev/null
printf 'DATABASE_URL\n'
EOS
chmod +x "$success_bin/op" "$success_bin/jq"

env PATH="$success_bin:$PATH" "$ROOT/scripts/sync" --project "$success_project_dir" --op-vault Gibbs --op-item prod.env --force >/dev/null
assert_contains "$(<"$success_project_dir/.env.agent.tpl")" "DATABASE_URL='op://Gibbs/prod.env/DATABASE_URL'"
assert_contains "$(<"$success_project_dir/.env.agent.tpl")" "OPENAI_API_KEY='op://Gibbs/prod.env/OPENAI_API_KEY'"
assert_contains "$(<"$success_project_dir/.env.agent.tpl")" "RENDER_API_KEY='op://Gibbs/prod.env/RENDER_API_KEY'"

quote_template="$tmp_dir/quote.tpl"
quote_output="$tmp_dir/.env.quote"
printf "QUOTED_SECRET='op://Vault/Item/KEY'\n" > "$quote_template"
cat > "$success_bin/op" <<'EOS'
#!/usr/bin/env bash
if [[ "$1" == "read" ]]; then
  printf "foo'bar"
  exit 0
fi
exit 1
EOS
chmod +x "$success_bin/op"
env PATH="$success_bin:$PATH" "$ROOT/scripts/sync" --template "$quote_template" --output "$quote_output" --force >/dev/null
assert_contains "$(<"$quote_output")" "QUOTED_SECRET='foo'\\''bar'"
loaded_secret="$(bash -c 'set -a; . "$1"; set +a; printf "%s" "$QUOTED_SECRET"' bash "$quote_output")"
[[ "$loaded_secret" == "foo'bar" ]] || fail "expected shell-escaped secret to source safely"

fail_project_dir="$tmp_dir/fail-project"
fake_bin="$tmp_dir/fake-bin"
mkdir -p "$fail_project_dir" "$fake_bin"
printf "DATABASE_URL=\n" > "$fail_project_dir/.env.example"
cat > "$fake_bin/op" <<'EOS'
#!/usr/bin/env bash
exit 1
EOS
cat > "$fake_bin/jq" <<'EOS'
#!/usr/bin/env bash
cat >/dev/null
EOS
chmod +x "$fake_bin/op" "$fake_bin/jq"

assert_failure \
  "sync does not create broad project template when 1Password field inspection fails" \
  env PATH="$fake_bin:$PATH" "$ROOT/scripts/sync" --project "$fail_project_dir" --op-vault Gibbs --op-item missing.env --force
[[ ! -e "$fail_project_dir/.env.agent.tpl" ]] || fail "unexpected template after failed 1Password inspection"

assert_failure \
  "db helper rejects missing env before psql requirement" \
  env -u PROD_DATABASE_URL "$ROOT/scripts/query" --dry-run -c "select 1;"

printf 'analyze-env self tests passed\n'
