---
name: ocenv
description: Implement and maintain the OpenClaw env setup used in this workspace. Use when asked to set up, debug, or explain how env variables and secrets should work for OpenClaw, shells, and token-dependent CLIs. Covers the canonical `.env.tpl` to `.env` sync flow, 1Password secret references, `/root/.openclaw/workspace/scripts/env-sync.sh`, and loading `/root/.openclaw/.env` from `/root/.profile` so normal shells and OpenClaw-spawned CLI processes inherit the env by default. Also use when debugging why a token is in `.env` but not available to commands, or when re-implementing this env solution on another machine.
always: true
emoji: 🔐
---

# OpenClaw Env Setup

Use this skill to implement the env pattern used on this machine.

## Canonical files

Use these paths:

- `/root/.openclaw/.env.bootstrap`
- `/root/.openclaw/.env.tpl`
- `/root/.openclaw/.env`
- `/root/.openclaw/workspace/scripts/env-sync.sh`
- `/root/.profile`

## Desired behavior

The system should work like this:

1. Secret references live in `/root/.openclaw/.env.tpl`.
2. `env-sync.sh` injects those refs into `/root/.openclaw/.env`.
3. `/root/.profile` loads `/root/.openclaw/.env` automatically.
4. New shells and normal CLI processes inherit the env by default.

Prefer this simple model over wrapper commands unless the user explicitly asks for tighter secret isolation.

## Template and sync flow

Use `.env.tpl` for 1Password references such as:

```bash
GITHUB_TOKEN="op://Vault/Item/password"
```

Use `env-sync.sh` to build the live env file from the template. Current expected implementation:

```bash
#!/usr/bin/env bash
set -euo pipefail

set -a
source /root/.openclaw/.env.bootstrap
set +a
op inject -f -i /root/.openclaw/.env.tpl -o /root/.openclaw/.env
chmod 600 /root/.openclaw/.env
printf 'Wrote /root/.openclaw/.env\n'
```

If sync fails, check the 1Password item name and field name first.

## Profile loading

`/root/.profile` should load the live env file near the top:

```bash
if [ -f /root/.openclaw/.env ]; then
  set -a
  . /root/.openclaw/.env
  set +a
fi
```

Keep this before sourcing `.bashrc`.

## Why this model exists

This setup is intentionally simple:
- one canonical template
- one generated runtime env file
- one sync script
- one default shell loading path

Avoid adding helper wrappers like `ocenv` or `withocenv` unless the user explicitly prefers them. The current standard is default env inheritance through `/root/.profile`.

## Validation

After implementing or changing the setup, verify:

1. `env-sync.sh` succeeds.
2. `/root/.openclaw/.env` contains the expected variable names.
3. `bash -lc 'echo ${GITHUB_TOKEN:+set}'` shows the token is available.
4. `sh -lc 'echo ${GITHUB_TOKEN:+set}'` also shows it is available.
5. A token-dependent CLI works without wrapper commands.

## Troubleshooting

If a token exists in `.env` but commands cannot see it:
- check whether `/root/.profile` is sourcing `.env`
- check whether the command path actually launches a shell that reads the profile
- check whether the token value is valid, not just present

Interpret common GitHub failures this way:
- `401 Bad credentials` means the token value is wrong, expired, or revoked
- `403` usually means the token is valid but under-scoped or blocked by org policy

## Default recommendation

When reproducing this setup on another machine:
- keep secrets canonical in `/root/.openclaw/.env.tpl`
- sync to `/root/.openclaw/.env`
- auto-load `/root/.openclaw/.env` from `/root/.profile`
- prefer simple default inheritance over per-command wrappers
