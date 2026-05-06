---
name: spec-review
description: >
  Review a pull request against its specification or ticket. Use when asked to
  review a PR for spec compliance, check if implementation matches a ticket,
  find discrepancies between code and spec, or audit a PR against requirements.
  Triggers on "review this PR against the spec", "does this PR match the ticket",
  "spec review", "check spec compliance", "find discrepancies", "review PR against
  requirements", "audit PR vs ticket".
---

# Spec Review

Structured review of a pull request against its specification. Finds discrepancies between what was specced and what was built.

## Workflow

### 1. Load the spec

Fetch the ticket/spec that the PR targets. Sources in priority order:

1. **Linear ticket** — if the PR title or body contains a ticket ID (e.g. `DOMA-449`), fetch it: `linear issue view <ID>`
2. **GitHub issue** — if the PR references an issue number, fetch it: `gh issue view <number> --repo <repo>`
3. **PR body** — if neither exists, treat the PR description as the spec
4. **User-provided** — if the user links or pastes a spec, use that

Read the entire spec. Do not skim. Identify:

- **Deliverables** — numbered or checkboxed items the spec says must ship
- **Acceptance criteria** — conditions the spec says must be true
- **Architectural decisions** — specific patterns, approaches, or designs prescribed
- **Non-goals** — things the spec explicitly excludes
- **Dependencies** — what must exist before or alongside this work

### 2. Load the PR

Fetch the PR diff and metadata:

```bash
gh pr view <number> --repo <repo> --json title,body,additions,deletions,changedFiles
gh pr diff <number> --repo <repo>
```

For large diffs (>3000 lines), prioritize:

- New files (most likely to contain spec-prescribed deliverables)
- Files mentioned in the spec's "Files Changed" section
- Test files (verify coverage claims)
- Modified files listed in the spec

Read the PR description. Note any claims about test counts, coverage, or design decisions — these are assertions to verify.

### 3. Map deliverables to code

For each spec deliverable, answer:

- **Present?** — Is there code that implements this deliverable?
- **Complete?** — Does the implementation cover the full deliverable, or only part of it?
- **Correct?** — Does the implementation match the spec's prescribed approach?

Build a checklist. Mark each deliverable as ✅ implemented, ⚠️ partially implemented, ❌ missing, or ↔️ deviated.

### 4. Find deviations

Deviations are implementations that differ from the spec. They are not automatically bugs — some are improvements. Categorize each:

**Architectural deviations** — the code uses a fundamentally different approach than specced. Examples:
- Spec says server-side redirect, code does client-side rendering
- Spec says direct API call, code adds an intermediate layer
- Spec says remove a dependency, code keeps it

**Behavioral deviations** — the code does something different than specced. Examples:
- Spec says "redirect to /login", code renders inline UI with a link
- Spec says "read expiry from response", code hardcodes a duration
- Spec says "remove X from context", code keeps X

**Additions** — code that goes beyond the spec. Not deviations per se, but worth noting:
- New components, constants, or utilities not mentioned in the spec
- Refactors or cleanups done alongside the specced work
- Features that anticipate future needs

For each deviation, note:
- What the spec says
- What the code does
- Whether the deviation is an improvement, a regression, or neutral
- Whether the spec should be updated to match

### 5. Find bugs

Separately from spec compliance, look for implementation bugs — error handling gaps, state management issues, security holes, race conditions. Bugs are distinct from deviations — a deviation is "built differently than specced," a bug is "built wrong regardless of spec."

### 6. Verify claims

Check assertions made in the PR description:

- **Test counts** — count the actual `it()` / `test()` blocks in test files. Compare to claimed count.
- **Design decisions** — if the PR says "X was done because Y," verify Y is true
- **Coverage claims** — if the PR says "all acceptance criteria met," check each one

### 7. Report

Structure the review as:

```
## Bugs
Numbered list. Each: what's wrong, where, why it matters, code snippet.

## Spec deviations
Numbered list. Each: what spec says, what code does, whether spec or code should change.

## Unspecced additions
Bullet list. Brief note on each. Flag as positive/neutral/concerning.
```

Keep it flat — no nested sub-sections. Bugs first (they block merge), deviations second (they need discussion), additions last (FYI).

If posting as a GitHub review comment, combine all sections into a single comment. Do not use inline review comments for spec-level findings — those belong in the summary.

## Principles

### The spec is the source of truth until proven wrong

Start from the assumption that the spec is correct. If the code deviates, the default position is that the code should change. Only flip this when the deviation is clearly an improvement — and note that the spec should be updated.

### Separate bugs from deviations

"Built differently than specced" and "built wrong" are different findings with different remediation paths. Don't conflate them. A deviation might be fine; a bug never is.

### Read the whole spec before reading code

Context matters. A deliverable that looks missing might be deferred to a later PR (check non-goals and phasing). An approach that looks wrong might be prescribed by a constraint documented in the spec's risk section.

### Verify, don't trust

PR descriptions are marketing. Test counts, coverage claims, and "all criteria met" assertions must be verified against the actual code. Authors aren't lying — they're approximating.

### Note what's good

If the PR adds valuable things beyond the spec (better error handling, route constants, component extraction), say so. Review is not just about finding problems.
