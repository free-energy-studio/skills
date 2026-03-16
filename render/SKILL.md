---
name: render
description: "Manage Render services, deploys, databases, and infrastructure from the CLI. Use when deploying, restarting, viewing logs, opening SSH/psql sessions, or validating render.yaml blueprints."
metadata:
  {
    "openclaw":
      {
        "emoji": "🚀",
        "requires": { "bins": ["render"], "env": [] },
      },
  }
---

# Render CLI Skill

Manage Render cloud services and datastores directly from the terminal using the [Render CLI](https://render.com/docs/cli).

## When to Use

- Deploying or restarting a Render service
- Listing services, deploys, or datastores
- Opening SSH or psql sessions to Render resources
- Viewing live service logs
- Validating `render.yaml` blueprint files
- Scripting Render operations in CI/CD

## Requirements

- `render` CLI installed (`brew install render` or [other methods](https://render.com/docs/cli#1-install-or-upgrade))
- Authenticated via `render login` or `RENDER_API_KEY` env var

## Commands

### Authentication

```bash
# Interactive login (opens browser)
render login

# Or set API key for non-interactive use
export RENDER_API_KEY=rnd_...
```

### Workspaces

```bash
# List workspaces
render workspaces

# Set active workspace
render workspace set
```

### Services

```bash
# List all services and datastores (interactive)
render services

# List services as JSON (non-interactive)
render services --output json --confirm
```

### Deploys

```bash
# List deploys for a service
render deploys list [SERVICE_ID]

# Trigger a deploy
render deploys create [SERVICE_ID]

# Deploy a specific commit
render deploys create [SERVICE_ID] --commit [SHA] --confirm

# Deploy a specific Docker image
render deploys create [SERVICE_ID] --image [URL] --confirm

# Deploy and wait for completion (useful in CI)
render deploys create [SERVICE_ID] --wait --confirm
```

### SSH

```bash
# SSH into a running service instance
render ssh [SERVICE_ID]

# Launch an ephemeral shell (isolated, no start command)
render ssh [SERVICE_ID] --ephemeral
```

### Postgres (psql)

```bash
# Open interactive psql session
render psql [DATABASE_ID]

# Run a single query
render psql [DATABASE_ID] -c "SELECT NOW();" -o text

# Query results as JSON
render psql [DATABASE_ID] -c "SELECT id, name FROM projects LIMIT 5;" -o json

# CSV output via psql passthrough
render psql [DATABASE_ID] -c "SELECT id, email FROM users;" -o text -- --csv
```

### Blueprints

```bash
# Validate render.yaml (defaults to ./render.yaml)
render blueprints validate

# Validate a specific file
render blueprints validate path/to/render.yaml
```

## Non-Interactive Mode

For scripting and CI/CD, use these flags:

| Flag | Description |
|------|-------------|
| `-o` / `--output` | Output format: `json`, `yaml`, `text`, or `interactive` (default) |
| `--confirm` | Skip confirmation prompts |

You can also set output format globally:

```bash
export RENDER_OUTPUT=json
```

## Tips

- Run `render` with no arguments to see all available commands
- Run `render help <command>` for details on any command
- Service IDs are optional in interactive mode — the CLI will prompt you to select
- Use `--wait` on `deploys create` in CI to block until the deploy finishes (non-zero exit on failure)
- CLI tokens expire periodically — re-authenticate with `render login` if needed
- Config is stored at `~/.render/cli.yaml` (override with `RENDER_CLI_CONFIG_PATH`)
