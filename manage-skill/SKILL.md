---
name: manage-skill
description: Install, update, remove, and manage agent skills using `npx skills`. Use when asked to install, add, update, remove, or set up a new skill. Handles discovery, copy-mode installation to ~/.openclaw/skills/, and gateway restart so the skill is immediately available. Triggers on "install skill", "add skill", "update skill", "remove skill", "set up skill", "npx skills".
---

# Install Skill

Install skills into OpenClaw using the `npx skills` CLI ([vercel-labs/skills](https://github.com/vercel-labs/skills)).

## Install Command

```bash
npx skills add <source> --skill <name> -g -y --copy
```

**Required flags for OpenClaw:**
- `-g` / `--global`: Install to user-level (`~/.openclaw/skills/`)
- `-y` / `--yes`: Skip prompts
- `--copy`: Copy files — symlinks break when the temp clone is deleted

**Optional flags:**
- `-a openclaw`: Target only OpenClaw (skip other agents). Use when you only need the skill here.
- `--list` / `-l`: List available skills without installing
- `--all`: Install all skills to all agents without prompts
- `--full-depth`: Deep recursive search when skills aren't in standard locations

## Source Formats

**Always use a remote source (GitHub/GitLab).** Local paths produce a broken hash in `skills-lock.json`, which means `npx skills update` will never detect changes. Remote sources get a real content hash and update correctly.

```bash
# GitHub shorthand (clones default branch)
npx skills add owner/repo

# Full GitHub URL
npx skills add https://github.com/owner/repo

# Specific branch via tree URL
npx skills add https://github.com/owner/repo/tree/branch-name

# Specific branch + subpath
npx skills add https://github.com/owner/repo/tree/branch-name/path/to/skills

# Skill filter (find skill named "foo" in default branch)
npx skills add owner/repo@foo

# GitLab
npx skills add https://gitlab.com/org/repo
```

**⚠️ Do NOT use local paths** (`npx skills add ./path`) — the lock file hash will be empty and updates will silently fail.

**⚠️ `owner/repo@thing` is a skill name filter, NOT a branch ref.** To target a non-default branch, use the full tree URL: `https://github.com/owner/repo/tree/branch-name`

The CLI clones the repo's **default branch**. If the default branch doesn't have the skill, use the tree URL.

## Skill Discovery

The CLI scans these locations for `SKILL.md` files with valid YAML frontmatter (`name` + `description`):

- Root directory, `skills/`, `.openclaw/skills/`, `.agents/skills/`, `.claude/skills/`, and 25+ other agent dirs
- `.claude-plugin/marketplace.json` or `plugin.json` if present
- Recursive fallback if no standard locations match

**If a skill isn't found:** Check that its SKILL.md has valid YAML frontmatter with `name` and `description` fields. Without both, the skill is invisible.

## Post-Install Checklist

1. **Verify copy** (not symlink):
   ```bash
   ls -la ~/.openclaw/skills/<name>/SKILL.md
   ```
   If symlink → reinstall with `--copy`.

2. **Restart gateway** so OpenClaw loads the new skill:
   Use the gateway restart tool.

## Other Commands

```bash
# List installed skills
npx skills list          # or: npx skills ls
npx skills ls -g         # global only

# Search for skills
npx skills find [query]

# Check for updates
npx skills check

# Update all installed skills
npx skills update

# Remove a skill
npx skills remove <name> -g -y

# Create new skill template
npx skills init [name]
```

## Updating an Installed Skill

```bash
npx skills update -g
```

Or remove and reinstall:
```bash
npx skills remove <name> -g -y
npx skills add <source> --skill <name> -g -y --copy
```

Then restart the gateway.

## Troubleshooting

- **"No matching skills found"**: SKILL.md missing or lacks `name`/`description` frontmatter
- **Wrong branch cloned**: Use `https://github.com/owner/repo/tree/branch` — not `owner/repo@branch`
- **Skill not in available_skills**: Restart the gateway
- **Permission errors**: Check write access to `~/.openclaw/skills/`

## Reference

- Skills directory: [skills.sh](https://skills.sh)
- Agent Skills spec: [agentskills.io](https://agentskills.io)
- OpenClaw skills docs: [docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills)
