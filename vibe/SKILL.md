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
---

# Vibe — Claude Code Workspaces

Dispatch coding tasks to Claude Code running as isolated Unix users with git worktrees.

## Architecture

- **User**: `vibe-<name>` — Linux account with its own creds and file ownership
- **Workspace**: git worktree at `~/workspaces/<slug>/`, identified by a 3-word slug
- **Auth**: `CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`, `LINEAR_API_KEY` in `~/.profile`
- **1Password**: each user has a `<name>.vibe` item in the `ichabod-doma` vault
- **Bare repos**: `~/repos/<org>--<repo>.git` — per-user fetch targets
- **Env files**: `~/envs/<org>--<repo>.env` — canonical secrets, copied into each worktree
- **Modes**: one-shot (`--print`) or interactive (tmux) — agent decides

## Decision: One-Shot vs Interactive

| Signal | Mode |
|--------|------|
| Well-defined task, clear acceptance criteria | **One-shot** |
| Ambiguous task, may need mid-flight steering | **Interactive** |
| Long-running, want to monitor progress | **Interactive** |
| Quick fix, small scope | **One-shot** |
| Need to approve/reject Claude Code prompts | **Interactive** |

Default to **one-shot** unless there's a reason to monitor.

---

## Step 1: Resolve User

Map the requester to a vibe user. The team:

| Person | User | 1Password Item |
|--------|------|----------------|
| Sam | `vibe-sam` | `sam.vibe` |
| Dan | `vibe-dan` | `dan.vibe` |
| Matt | `vibe-chmiel` | `chmiel.vibe` |
| Kelani | `vibe-kelani` | `kelani.vibe` |
| Toby | `vibe-toby` | `toby.vibe` |
| Nilesh | `vibe-nilesh` | `nilesh.vibe` |

If no user is specified, use the requester's identity. If ambiguous, ask.

## Step 2: Ensure User Exists

Check the user exists and has valid credentials:

```bash
# Check user exists
id vibe-<name> >/dev/null 2>&1
```

### If user doesn't exist — create:

```bash
# Create user with home dir
useradd -m -s /bin/bash -G vibe vibe-<name>

# Pull creds from 1Password and write to profile
OP_ITEM="<name>.vibe"
VAULT="ichabod-doma"

CLAUDE_TOKEN=$(op read "op://$VAULT/$OP_ITEM/CLAUDE_CODE_OAUTH_TOKEN")
GH_TOKEN=$(op read "op://$VAULT/$OP_ITEM/GH_TOKEN")
LINEAR_KEY=$(op read "op://$VAULT/$OP_ITEM/LINEAR_API_KEY")

cat >> /home/vibe-<name>/.profile << 'VIBEEOF'
export CLAUDE_CODE_OAUTH_TOKEN='$CLAUDE_TOKEN'
export GH_TOKEN='$GH_TOKEN'
export LINEAR_API_KEY='$LINEAR_KEY'
VIBEEOF

# Fix ownership
chown vibe-<name>:vibe /home/vibe-<name>/.profile
```

### Validate credentials:

```bash
# Claude — check auth
sudo -u vibe-<name> -H bash -lc 'cd /tmp && claude auth status 2>&1'
# Expect: {"loggedIn": true, ...}

# GitHub — check auth
sudo -u vibe-<name> -H bash -lc 'gh auth status 2>&1'

# Linear — just check the var is set
sudo -u vibe-<name> -H bash -lc 'test -n "$LINEAR_API_KEY" && echo "ok"'
```

If any credential is missing or invalid, pull fresh from 1Password and update `.profile`.

## Step 2b: Set Up Repo (first time per user per repo)

Each user needs a bare clone and a canonical `.env` for each repo they work on.

### Bare clone:

```bash
sudo -u vibe-<name> -H bash -lc "
  mkdir -p ~/repos ~/envs
  gh repo clone <org>/<repo> ~/repos/<org>--<repo>.git -- --bare
"
```

### Secrets:

Repos may provide a script to pull secrets (e.g. `bun run secrets:pull`, `op run`, a Makefile target). Check the repo's `package.json`, README, or `.env.example` to determine how.

To run repo scripts, create a temporary worktree:

```bash
sudo -u vibe-<name> -H bash -lc "
  cd ~/repos/<org>--<repo>.git
  git worktree add /tmp/vibe-env-setup origin/main
  cd /tmp/vibe-env-setup
  # ... run whatever the repo provides to generate .env ...
  cp .env ~/envs/<org>--<repo>.env
  cd ~/repos/<org>--<repo>.git
  git worktree remove /tmp/vibe-env-setup --force
"
```

If the repo has no secrets script, create `~/envs/<org>--<repo>.env` manually from `.env.example` or existing environments.

This is a **one-time setup** per user per repo. The canonical env file is reused across all worktrees.

## Step 3: Generate Slug

Generate a unique 3-word slug for the workspace:

```bash
# Use shuf with curated word lists or generate randomly
SLUG="$(shuf -n1 -e calm bold cool dark deep fair fast firm fond free fresh glad good keen kind lean live long mild neat nice open pale pure rare raw rich ripe safe slim soft sure tall thin trim true warm wide wise)-$(shuf -n1 -e ash bay bog cay dam den dew elm fen fig fir fog fox fur gap gem glen hay ice ivy jam jay jet keg lake lark loom marsh mist moss oak orb ore peak pine plum pond quay raft reed reef ridge rim rock rye sage salt sand sea shell shore silk sky snow soot star stem sun surf tide vale vine wave well yew)-$(shuf -n1 -e ant ape bass bear bee bird boar buck bull carp cat clam cod colt crab crane crow cub dart deer doe dove duck eagle eel elk ewe fawn fish flea foal fox frog gull hare hawk hen hog ibis jay kit kite lamb lark lynx mare mink mole moth mule newt osprey otter owl ox perch pike quail ram rook seal shad shrew slug snail snipe sole stag stork swan tern toad trout vole wasp wren yak)"
echo "$SLUG"
```

Check it's not already in use:

```bash
ls /home/vibe-<name>/workspaces/$SLUG 2>/dev/null && echo "COLLISION" || echo "OK"
```

## Step 4: Create Workspace

### Ensure bare repo exists:

```bash
REPO="ondomain/ichabod-doma"  # or whatever repo
BARE_DIR="/home/vibe-<name>/repos/ondomain--ichabod-doma.git"

if [ ! -d "$BARE_DIR" ]; then
  sudo -u vibe-<name> -H bash -lc "
    mkdir -p ~/repos
    gh repo clone $REPO ~/repos/ondomain--ichabod-doma.git -- --bare
  "
fi

# Fetch latest
sudo -u vibe-<name> -H bash -lc "cd $BARE_DIR && git fetch origin"
```

### Create worktree:

```bash
BRANCH="sam/fix-auth-bug"  # the working branch
BASE="main"                # branch to fork from

sudo -u vibe-<name> -H bash -lc "
  cd $BARE_DIR
  git worktree add ~/workspaces/$SLUG -b $BRANCH origin/$BASE
"
```

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

The copy is intentional — worktrees may need overrides (ports, feature flags, test databases).

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

## Step 5: Run Claude Code

### One-Shot Mode

Blocking execution. Stdout returns directly.

```bash
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  claude --print --dangerously-skip-permissions '<task description>'
"
```

Run via `exec`. The agent waits for completion and gets output directly.

For large tasks, use `exec` with `background: true` and monitor via `process`.

### Interactive Mode

Persistent tmux session. Agent monitors and steers.

```bash
# Create tmux session (run as the vibe user)
sudo -u vibe-<name> -H tmux new-session -d -s "$SLUG" -c "/home/vibe-<name>/workspaces/$SLUG"

# Launch Claude Code inside
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" \
  "claude --dangerously-skip-permissions" Enter

# Wait for Claude to initialize, then send the task
sleep 3
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" -l -- '<task description>'
sleep 0.1
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" Enter
```

#### Monitor:

```bash
# Check latest output
sudo -u vibe-<name> -H tmux capture-pane -t "$SLUG" -p | tail -20

# Check if waiting for input
sudo -u vibe-<name> -H tmux capture-pane -t "$SLUG" -p | tail -5 | grep -E "❯|yes/no|proceed|Y/n"
```

#### Steer:

```bash
# Send follow-up instruction
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" -l -- 'Also fix the tests'
sleep 0.1
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" Enter

# Approve a prompt
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" 'y' Enter

# Cancel current operation
sudo -u vibe-<name> -H tmux send-keys -t "$SLUG" Escape
```

#### Check if done:

```bash
# Look for the idle prompt (❯) with no activity
sudo -u vibe-<name> -H tmux capture-pane -t "$SLUG" -p | tail -3
```

## Step 6: Push & PR

After Claude Code finishes (or you've verified the work):

```bash
# Push the branch
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  git push origin HEAD
"

# Open PR
sudo -u vibe-<name> -H bash -lc "
  cd ~/workspaces/$SLUG
  gh pr create --title '<PR title>' --body '<description>' --base main
"
```

**Important**: Sam opens PRs to `main` and approves merges. Never run `gh pr merge` on main without his explicit say-so.

## Step 7: Cleanup

After the PR is merged or work is abandoned:

```bash
# Kill tmux session (interactive mode only)
sudo -u vibe-<name> -H tmux kill-session -t "$SLUG" 2>/dev/null

# Remove worktree
sudo -u vibe-<name> -H bash -lc "
  cd ~/repos/ondomain--ichabod-doma.git
  git worktree remove ~/workspaces/$SLUG --force
"
```

## Listing Active Workspaces

```bash
# All workspaces for a user
ls /home/vibe-<name>/workspaces/

# All tmux sessions for a user
sudo -u vibe-<name> -H tmux list-sessions 2>/dev/null

# All workspaces across all users
for u in /home/vibe-*/; do
  user=$(basename "$u")
  echo "=== $user ==="
  ls "$u/workspaces/" 2>/dev/null
done
```

## Git Identity

Each user should have a `.gitconfig` with their identity. Set during provisioning if missing:

```bash
sudo -u vibe-<name> -H git config --global user.name "<Human Name>"
sudo -u vibe-<name> -H git config --global user.email "<email>"
```

## Troubleshooting

**Claude Code EACCES on /root**: Always `cd` to the workspace or `/tmp` before running claude commands. Claude Code tries to resolve the cwd and fails if it's root-owned.

**Auth expired**: Re-pull from 1Password:
```bash
NEW_TOKEN=$(op read "op://ichabod-doma/<name>.vibe/CLAUDE_CODE_OAUTH_TOKEN")
sudo -u vibe-<name> -H bash -c "sed -i 's|CLAUDE_CODE_OAUTH_TOKEN=.*|CLAUDE_CODE_OAUTH_TOKEN='\"'$NEW_TOKEN'\"'|' ~/.profile"
```

**Worktree conflicts**: If branch already exists locally:
```bash
sudo -u vibe-<name> -H bash -lc "cd ~/repos/ondomain--ichabod-doma.git && git branch -D <branch>"
```

**tmux session exists**: Kill and recreate:
```bash
sudo -u vibe-<name> -H tmux kill-session -t "$SLUG"
```

**Push rejected**: Fetch and rebase first:
```bash
sudo -u vibe-<name> -H bash -lc "cd ~/workspaces/$SLUG && git pull --rebase origin main"
```
