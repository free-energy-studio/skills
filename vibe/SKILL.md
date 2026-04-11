---
name: vibe
description: >
  Dispatch coding tasks to Claude Code via isolated Unix user workspaces.
  Use when: building features, fixing bugs, prototyping, refactoring,
  or any coding work that should run in an isolated environment.
  Triggers on "build this", "fix this", "vibe on", "spin up a workspace",
  "run claude code on", or any request to delegate coding work.
  NOT for: simple one-liner edits (use edit tool), reading code (use read tool),
  or work in the openclaw workspace (never spawn agents here).
metadata:
  openclaw:
    emoji: "⚡"
    os: ["linux"]
    always: true
    requires:
      bins: ["claude", "gh", "op"]
    install:
      - id: node-claude
        kind: node
        package: "@anthropic-ai/claude-code"
        bins: ["claude"]
        label: "Install Claude Code CLI (npm)"
---

# Vibe — Claude Code Workspaces

Dispatch coding tasks to Claude Code running as isolated Unix users with git worktrees.

## Architecture

- **User**: `vibe-<name>` — Linux account with its own creds and file ownership
- **Workspace**: git worktree at `~/workspaces/<slug>/`, identified by a 3-word slug
- **Auth**: `CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`, `LINEAR_API_KEY` in `~/.profile`
- **1Password**: each user has a `<name>.vibe` item with their credentials
- **Bare repos**: `~/repos/<org>--<repo>.git` — per-user fetch targets
- **Env files**: `~/envs/<org>--<repo>.env` — canonical secrets, copied into each worktree
- **ACP alias**: `claude-<name>` — ACP agent id that maps to the shared wrapper for that user
- **Wrapper**: shared `claude-user-acp` launcher, source-controlled in `scripts/` and installed to `/usr/local/bin/claude-user-acp`
- **Modes**: bounded ACP runs by default, persistent ACP sessions only when continuity actually helps
- **Services**: tunneling requires managed services, not an ad-hoc shell process. Use `vibe-dev-<slug>.service` for the app process and `vibe-tunnel-<slug>.service` for the public URL.

## Orchestrator Mindset

When using this skill, your primary job is **orchestration**, not personally doing all the coding work.

- **Delegate aggressively.** Use Claude Code for repo exploration, implementation, test/fix loops, review response handling, and other bounded coding tasks. Keep only the orchestration, judgment, and user communication in the parent agent.
- **Surface status like an operator.** Do not go silent while a sub-agent runs. Tell the user what is happening, what just finished, what is blocked, and what you are doing next.
- **Surface issues immediately.** If setup fails, auth is broken, the prompt was malformed, tests fail, or the task is underspecified, tell the user promptly instead of waiting for a long run to end.
- **Treat large work as a sequence of sub-runs.** For a large ticket, epic, or sticky problem, break it into concrete chunks and run Claude Code on one chunk at a time. After each run, inspect the result, decide the next slice, and launch the next run until the larger problem is actually done.
- **Do not make the user reverse-engineer progress from raw logs.** Summarize the state in plain language.

## Decision: Bounded ACP Runs vs Persistent ACP Sessions

| Signal | Mode |
|--------|------|
| Well-defined task, clear acceptance criteria | **Bounded ACP run** |
| Quick fix, small scope | **Bounded ACP run** |
| Large multi-part problem that should be split into phases | **Sequential bounded ACP runs** |
| Need continuity across follow-ups in the same workspace | **Persistent ACP session** |
| Need to keep a long-lived coding session attached to the workspace | **Persistent ACP session** |

Default to **bounded ACP runs**. For big problems, default to a **sequence of bounded runs**, not one giant prompt or a permanently open session.

---

## Step 1: Resolve User

Map the requester to a `vibe-<name>` user. Maintain a user roster in your workspace docs (e.g. TEAM.md) mapping people to their vibe username and 1Password item name.

If no user is specified, use the requester's identity. If ambiguous, ask.

## Step 2: Ensure User Exists

Check the user exists and has valid credentials:

```bash
# Check user exists
id vibe-<name> >/dev/null 2>&1
```

### If user doesn't exist — create:

```bash
# Create user with home dir, add to vibe group
useradd -m -s /bin/bash -G vibe vibe-<name>

# Pull creds from 1Password and write to profile
OP_ITEM="<name>.vibe"
VAULT="<your-vault>"

CLAUDE_TOKEN=$(op read "op://$VAULT/$OP_ITEM/CLAUDE_CODE_OAUTH_TOKEN")
GH_TOKEN_VAL=$(op read "op://$VAULT/$OP_ITEM/GH_TOKEN")
LINEAR_KEY=$(op read "op://$VAULT/$OP_ITEM/LINEAR_API_KEY")

# Write to profile (use heredoc with actual values, not variable refs)
cat >> /home/vibe-<name>/.profile << EOF
export CLAUDE_CODE_OAUTH_TOKEN='$CLAUDE_TOKEN'
export GH_TOKEN='$GH_TOKEN_VAL'
export LINEAR_API_KEY='$LINEAR_KEY'
EOF

# Fix ownership
chown vibe-<name>:vibe /home/vibe-<name>/.profile

# Set git identity + credential helper
sudo -u vibe-<name> -H bash -c "cd ~ && git config --global user.name '<Human Name>'"
sudo -u vibe-<name> -H bash -c "cd ~ && git config --global user.email '<email>'"
sudo -u vibe-<name> -H bash -c "cd ~ && git config --global credential.https://github.com.helper '!/usr/bin/gh auth git-credential'"
```

### Validate credentials:

```bash
# Claude — check auth (cd to /tmp to avoid EACCES on root-owned dirs)
sudo -u vibe-<name> -H bash -lc 'cd /tmp && claude auth status 2>&1'
# Expect: {"loggedIn": true, ...}

# GitHub — check auth
sudo -u vibe-<name> -H bash -lc 'gh auth status 2>&1'

# Linear — check the var is set
sudo -u vibe-<name> -H bash -lc 'test -n "$LINEAR_API_KEY" && echo "ok"'
```

If any credential is missing or invalid, pull fresh from 1Password and update `.profile`.

## Step 2b: Ensure the Shared ACP Wrapper and Per-User Alias Exist

Vibe is responsible for the Unix-user/workspace model. Claude execution should happen through ACP, using a per-user alias that launches the shared wrapper as the correct Unix user.

### Wrapper source and install path

- Source-controlled wrapper: `{baseDir}/scripts/claude-user-acp`
- Installed runtime path: `/usr/local/bin/claude-user-acp`

Install or refresh it when missing or outdated:

```bash
install -m 755 {baseDir}/scripts/claude-user-acp /usr/local/bin/claude-user-acp
```

### Per-user alias

For `vibe-sam`, the ACP alias should be `claude-sam`.

Register the alias in ACPX config:

```bash
openclaw config set plugins.entries.acpx.config.agents.claude-<name>.command \
  "/usr/local/bin/claude-user-acp vibe-<name>"
```

If you changed the ACPX config, restart the gateway once so the alias is live:

```bash
openclaw gateway restart
```

Then verify the alias with a tiny ACP one-shot in a user-owned cwd before trusting it for real work.

## Step 2c: Set Up Repo (first time per user per repo)

Each user needs a bare clone and a canonical `.env` for each repo they work on.

### Bare clone:

```bash
sudo -u vibe-<name> -H bash -lc "
  mkdir -p ~/repos ~/envs
  git clone --bare https://github.com/<org>/<repo>.git ~/repos/<org>--<repo>.git
"
```

**Note:** In a bare clone, all remote branches are stored directly under `refs/heads/` (e.g. `refs/heads/main`). There are no `refs/remotes/origin/` tracking refs. When creating worktrees from a bare repo, use branch names like `main` or `HEAD` — **not** `origin/main`.

### Secrets:

Repos may provide a script to pull secrets (e.g. a `secrets:pull` script, `op run`, a Makefile target). Check the repo's `package.json`, README, or `.env.example` to determine how.

To run repo scripts, create a temporary worktree:

```bash
sudo -u vibe-<name> -H bash -lc "
  TMPWT=/tmp/vibe-env-setup-\$\$
  cd ~/repos/<org>--<repo>.git
  git worktree add \$TMPWT HEAD
  cd \$TMPWT
  # ... run whatever the repo provides to generate .env ...
  cp .env ~/envs/<org>--<repo>.env
  cd ~/repos/<org>--<repo>.git
  git worktree remove \$TMPWT --force
"
```

If the repo has no secrets script, create `~/envs/<org>--<repo>.env` manually from `.env.example` or existing environments.

This is a **one-time setup** per user per repo. The canonical env file is reused across all worktrees.

## Step 3: Generate Slug

Generate a unique 3-word slug for the workspace. The slug script lives next to this skill file — when installed via `install.sh`, it is at `~/.local/share/free-energy-skills/vibe/scripts/slug.sh`.

```bash
SKILL_DIR="${HOME}/.local/share/free-energy-skills/vibe"

# Retry until a non-colliding slug is found (collisions are rare but possible)
while true; do
  SLUG=$(bash "$SKILL_DIR/scripts/slug.sh")
  ls "/home/vibe-<name>/workspaces/$SLUG" 2>/dev/null || break
  echo "Slug collision: $SLUG — retrying..."
done
echo "Using slug: $SLUG"
```

The script generates `adj-noun-noun` slugs with ~2.1M permutations (100 adjectives × 145 nouns × 145 nouns).

## Step 4: Create Workspace

Workspaces can be **repo-backed** (git worktree) or **standalone** (empty directory for prototyping, one-off tasks, or non-repo work).

### Standalone (no repo):

```bash
sudo -u vibe-<name> -H bash -lc "mkdir -p ~/workspaces/$SLUG"
```

Skip to Step 5.

### Repo-backed — ensure bare repo exists:

```bash
BARE_DIR="/home/vibe-<name>/repos/<org>--<repo>.git"

if [ ! -d "$BARE_DIR" ]; then
  sudo -u vibe-<name> -H bash -lc "
    mkdir -p ~/repos
    git clone --bare https://github.com/<org>/<repo>.git ~/repos/<org>--<repo>.git
  "
fi

# Fetch latest
sudo -u vibe-<name> -H bash -lc "cd $BARE_DIR && git fetch origin"
```

### Create worktree:

```bash
BRANCH="<user>/<feature-name>"  # working branch (see naming below)

# Detect the repo's default branch (don't hardcode main)
BASE=$(sudo -u vibe-<name> -H bash -lc "
  git -C $BARE_DIR symbolic-ref --short HEAD 2>/dev/null || echo main
")

sudo -u vibe-<name> -H bash -lc "
  cd $BARE_DIR
  git worktree add ~/workspaces/$SLUG -b $BRANCH $BASE
"
```

**Important:** Use `$BASE` (the branch name, e.g. `main`), not `origin/$BASE`. In a bare clone, refs live at `refs/heads/`, so `origin/main` does not exist — `main` does.

If the branch already exists remotely:

```bash
sudo -u vibe-<name> -H bash -lc "
  cd $BARE_DIR
  git fetch origin $BRANCH
  git worktree add ~/workspaces/$SLUG $BRANCH
"
```

### Copy env:

```bash
ENV_FILE="/home/vibe-<name>/envs/<org>--<repo>.env"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" /home/vibe-<name>/workspaces/$SLUG/.env
  chown vibe-<name>:vibe /home/vibe-<name>/workspaces/$SLUG/.env
fi
```

The copy is intentional — worktrees may need per-instance overrides.

### Configure env:

After copying, review the `.env` and adjust for the worktree. At minimum, set a unique `PORT`. If you will tunnel the workspace, the managed dev service must read the same env.

### Run setup (if repo has it):

```bash
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  if [ -f package.json ] && grep -q '\"setup\"' package.json; then
    bun run setup
  elif [ -f package.json ]; then
    bun install
  fi
"
```

### Branch naming:

When the task is tied to a Linear ticket, use the Linear git branch name (e.g. `sam/doma-123-fix-auth-token`). You can get it from Linear's UI or via the API. This keeps branches traceable to tickets.

## Step 5: Run Claude Code

### Step 5a: Decide the orchestration shape

Before launching Claude Code, decide whether you are dispatching **one bounded ACP run**, **a sequence of runs**, or **a persistent ACP session**.

#### Small / medium task

Give Claude one clear assignment with acceptance criteria, let it run, then review the result.

#### Large task, epic, or sticky problem

Break the work into sequential slices. If the request maps naturally to subtickets or subproblems, treat each one as its own Claude ACP run.

Typical pattern:

1. **Discovery / scoping pass** — inspect the repo, confirm the real shape of the problem, and propose a concrete implementation plan
2. **Implementation pass for slice 1** — make the first bounded change
3. **Validation / repair pass** — run tests, fix regressions, clean up
4. **Next implementation pass(es)** — continue one slice at a time until the larger job is complete

After each pass:

- inspect the diff and validation output yourself
- decide whether the next step should be another Claude run, a change in direction, or a user decision
- send the user a brief status update if the state changed materially

Prefer multiple small Claude ACP runs over one oversized prompt that tries to solve the whole problem blindly.

### Step 5b: User-facing status updates

When vibing, keep the user informed in operator language:

- **At start:** say what sub-agent you launched and what it is working on
- **At milestones:** report meaningful completions, not token-by-token chatter
- **At blockers/failures:** explain the issue, impact, and next action immediately
- **At handoff points:** say whether you are launching another sub-run or waiting on a decision

Good examples:

- "I have Claude doing repo discovery in the new workspace now. Next step is implementation once it confirms the shape."
- "The workspace is ready, but the ACP alias is still misconfigured. I'm fixing the wrapper path before launching the coding pass."
- "Claude finished slice 1 and tests pass. I'm sending it back in for the follow-up cleanup pass."

Bad examples:

- disappearing for a long run with no update
- dumping raw command output without interpretation
- waiting until the end to mention the run failed halfway through

### Step 5c: Bounded ACP Run

Default path. Use the per-user ACP alias in the user-owned workspace.

Example tool call shape:

```json
sessions_spawn({
  runtime: "acp",
  agentId: "claude-<name>",
  mode: "run",
  cwd: "/home/vibe-<name>/workspaces/<slug>",
  task: "<bounded task with acceptance criteria>",
  runTimeoutSeconds: 180,
  timeoutSeconds: 240,
  cleanup: "delete",
  streamTo: "parent"
})
```

Rules:

- `cwd` must be the user-owned workspace, not `/root/...`
- keep prompts bounded and explicit
- prefer multiple sequential runs over one giant prompt
- report meaningful milestones from the child run back to the user

### Step 5d: Persistent ACP Session

Use a persistent ACP session only when continuity across follow-ups is genuinely useful.

Example tool call shape:

```json
sessions_spawn({
  runtime: "acp",
  agentId: "claude-<name>",
  mode: "session",
  cwd: "/home/vibe-<name>/workspaces/<slug>",
  task: "<initial task>",
  streamTo: "parent"
})
```

After spawn, keep follow-ups routed to that same ACP session instead of opening duplicate sessions. Use persistent sessions sparingly. The default should still be bounded runs.

### Step 5e: No tmux fallback

Do not silently drop to tmux or direct `claude --print` execution. If ACP fails, fix the alias, wrapper, auth, or permissions problem and then retry ACP.

## Step 6: Tunnel (optional, but service-backed)

If the worktree needs a public URL (e.g. for webhooks, mobile testing, sharing), do **not** tunnel directly to an ad-hoc shell process. A tunneled workspace must have two managed services:

- `vibe-dev-<slug>.service` — runs the app/dev server on the chosen local port
- `vibe-tunnel-<slug>.service` — exposes that local port at `<slug>.<tunnel-domain>`

If you cannot create or manage services on the host, do not offer tunneling. Keep the workspace private and tell the user what is missing.

### Required rule

**Whenever tunneling is enabled, enforce managed services for both the app process and the tunnel.**

### Dev service

Create a service whose working directory is the workspace and whose command starts the repo's long-lived app process on the workspace port.

Recommended naming:

```bash
vibe-dev-<slug>.service
```

Recommended behavior:
- restart automatically on failure
- run as the appropriate `vibe-<name>` user when possible
- read the same env as the workspace
- bind to the workspace's assigned port

Example shape:

```ini
[Unit]
Description=Vibe dev server for <slug>
After=network.target

[Service]
User=vibe-<name>
WorkingDirectory=/home/vibe-<name>/workspaces/<slug>
Environment=PORT=<port>
ExecStart=/usr/bin/bash -lc 'cd /home/vibe-<name>/workspaces/<slug> && <dev-command>'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Tunnel service

Create a separate service for the tunnel process or host-managed tunnel binding.

Recommended naming:

```bash
vibe-tunnel-<slug>.service
```

If using a shared `cloudflared` config, add an ingress rule for the slug and make sure the host-level tunnel process is reloaded. If using a dedicated tunnel service per workspace, point it at `http://127.0.0.1:<port>` and enable restart behavior.

### Validation

Do not call a tunneled workspace ready until all of the following pass:

```bash
systemctl is-active vibe-dev-<slug>.service
systemctl is-active vibe-tunnel-<slug>.service
curl -I https://<slug>.<tunnel-domain>
```

The tunnel domain, service manager, and cloudflared config path are host-specific — check the host's actual setup.

### DNS

The subdomain must have a CNAME pointing to the tunnel. If using a wildcard CNAME (`*.ondomain.dev → tunnel`), no DNS changes are needed. Otherwise, add the record.

## Step 6: Push & PR

After Claude Code finishes (or you've verified the work):

```bash
# Push the branch
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  git push origin HEAD
"

# Open PR (use $BASE from Step 4 — do not hardcode main)
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  gh pr create --title '<PR title>' --body '<description>' --base $BASE
"
```

Capture the PR number from the output (e.g. `https://github.com/org/repo/pull/123` → `123`).

### Step 6b: Review Watch Loop

After the PR is created, watch for review comments and address them automatically.

**Parameters:**
- `POLL_INTERVAL`: 60 seconds between checks
- `POLL_TIMEOUT`: 30 minutes max wait for initial review
- `MAX_ROUNDS`: 5 revision rounds (prevent infinite loops)

#### Poll for reviews:

```bash
# Fetch pending (non-resolved) review comments
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  gh api repos/<org>/<repo>/pulls/<PR>/comments \
    --jq '[.[] | select(.in_reply_to_id == null)] | length'
"
```

Poll every `POLL_INTERVAL` seconds. If no comments appear within `POLL_TIMEOUT`, stop watching — the PR is waiting on human review and the agent should move on.

#### For each round (up to MAX_ROUNDS):

**1. Fetch comments:**

```bash
# Get all pending review comments with file, line, and body
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  gh api repos/<org>/<repo>/pulls/<PR>/reviews \
    --jq '[.[] | select(.state == \"CHANGES_REQUESTED\" or .state == \"COMMENTED\")]'
"

sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  gh api repos/<org>/<repo>/pulls/<PR>/comments \
    --jq '[.[] | {id, path, line, body, in_reply_to_id, created_at}]'
"
```

**2. Dispatch Claude Code to fix:**

Run an ACP task through `claude-<name>` with the review comments as context. Keep it bounded: fix the comments, run validation, and summarize any comments that need a human response.

**3. Push fixes:**

```bash
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  git push origin HEAD
"
```

**4. Respond to comments:**

For each comment, post a reply explaining what was done:

```bash
# Reply to a specific comment
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  gh api repos/<org>/<repo>/pulls/<PR>/comments \
    -X POST \
    -f body='<response explaining the fix or rationale>' \
    -F in_reply_to=<comment_id>
"
```

Use concise replies: "Fixed" / "Updated — changed X to Y" / "This is intentional because..." — no fluff.

**5. Check for new comments:**

After pushing, wait one `POLL_INTERVAL` and check for new comments. If none, the review loop is done. If new comments arrived (reviewer responded or new review round), continue to the next round.

#### Exit conditions:

- **All comments addressed** and no new comments after push → done ✅
- **MAX_ROUNDS reached** → stop, report remaining unresolved comments to the agent operator
- **POLL_TIMEOUT hit** waiting for initial review → stop, workspace stays open for later
```

## Step 7: Cleanup

After the PR is merged or work is abandoned, tear down everything associated with the slug.

### Remove tunnel (if created):

Stop and disable the workspace services first, then remove the tunnel route or dedicated tunnel unit.

```bash
systemctl disable --now vibe-tunnel-<slug>.service 2>/dev/null || true
systemctl disable --now vibe-dev-<slug>.service 2>/dev/null || true

# If using a shared cloudflared config, remove the slug's ingress rule and reload.
systemctl restart cloudflared
```

### Remove workspace:

```bash
# Repo-backed: remove worktree
sudo -u vibe-<name> -H bash -lc "
  cd ~/repos/<org>--<repo>.git
  git worktree remove ~/workspaces/$SLUG --force
"

# Standalone: just delete
sudo -u vibe-<name> -H rm -rf ~/workspaces/$SLUG
```

## Listing Active Workspaces

```bash
# All workspaces for a user
ls /home/vibe-<name>/workspaces/

# All workspaces across all users
for u in /home/vibe-*/; do
  user=$(basename "$u")
  echo "=== $user ==="
  ls "$u/workspaces/" 2>/dev/null
done

# Service-backed tunneled workspaces
systemctl list-units --all --type=service 'vibe-dev-*' 'vibe-tunnel-*'
```

## Troubleshooting

**Claude Code EACCES on /root**: Always `cd` to the workspace or `/tmp` before running claude commands. Claude Code tries to resolve the cwd and fails if it's root-owned.

**Auth expired**: Re-pull from 1Password and update the relevant line in `~/.profile`.

**`git worktree add` fails with "invalid reference" or "unknown revision"**: Bare clones store refs under `refs/heads/`, not `refs/remotes/origin/`. Use the branch name directly:
```bash
# Wrong — origin/main does not exist in a bare clone:
git worktree add ~/workspaces/$SLUG -b branch origin/main
# Right:
git worktree add ~/workspaces/$SLUG -b branch main
```
If the default branch isn't `main`, detect it first:
```bash
BASE=$(git -C ~/repos/<org>--<repo>.git symbolic-ref --short HEAD)
```

**Worktree conflicts**: If branch already exists locally:
```bash
sudo -u vibe-<name> -H bash -lc "cd ~/repos/<org>--<repo>.git && git branch -D <branch>"
```

**ACP alias missing or wrong user**: Reinstall the shared wrapper, verify `plugins.entries.acpx.config.agents.claude-<name>.command`, restart the gateway, then run a tiny ACP proof task in the workspace before retrying the real job.

**Tunneled URL is flaky or down**: Check the managed services first:
```bash
systemctl status vibe-dev-<slug>.service
systemctl status vibe-tunnel-<slug>.service
curl -I https://<slug>.<tunnel-domain>
```
If the workspace is tunneled, fix the services instead of launching another ad-hoc dev process.

**Push rejected**: Fetch and rebase first:
```bash
sudo -u vibe-<name> -H bash -lc "cd ~/workspaces/$SLUG && git pull --rebase origin main"
```
