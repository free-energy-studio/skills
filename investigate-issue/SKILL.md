---
name: investigate-issue
description: >
  Deep-dive diagnostic investigation of bug reports. Use when someone reports
  a bug, unexpected behavior, or something broken. Drives a structured
  investigation - validate the issue, document it in a ticket, diagnose root
  cause through database/code/history analysis, determine the fix, and report
  back. Triggers on bug reports, something is broken, this happened twice,
  screenshots of unexpected behavior, investigate this, look into this issue.
---

# Investigate Issue

Structured diagnostic investigation for bug reports. Works with any codebase and issue tracker.

## Workflow

Follow these steps in order. Do not skip steps or jump to solutions.

### 1. Intake

Parse the bug report. Extract:

- **What happened** — the observable symptom
- **Who's affected** — user, account, session, entity
- **When** — timestamps, frequency, first occurrence
- **Where** — which feature, endpoint, channel, environment
- **Evidence** — screenshots, logs, error messages

If the report is ambiguous, ask one clarifying question. Don't start investigating on assumptions.

### 2. Validate

Confirm the issue exists independently. Do not take the report at face value.

- Query the database for the affected entities
- Reproduce the timeline from data (timestamps, message logs, job history)
- Check if the reported behavior matches what the data shows
- Quantify scope: is this one instance or a pattern?

If the issue cannot be validated, report that finding and stop.

### 3. Document

Create an investigation ticket:

- **Title:** Descriptive summary of the confirmed problem
- **Label:** `Investigation`
- **Description:** Include:
  - Bug report summary (with screenshots if available)
  - Evidence from validation (queries, data, timeline)
  - Affected entities (IDs, names, timestamps)
- **No solutions yet.** The investigation ticket describes the problem, not the fix.

### 4. Diagnose

This is the core of the investigation. It is iterative — expect to be wrong multiple times before landing on the root cause.

#### Trace the data lifecycle

Most bugs live in the gap between "what the system stored" and "what the system acted on." Data typically passes through multiple transforms before reaching a decision point:

1. **Storage** — what's in the database
2. **Loading** — what gets queried (filters, limits, joins)
3. **Processing** — transforms, caches, preprocessing applied after loading
4. **Rendering** — how data is formatted for the consumer (UI, model, API)

Trace the full pipeline for the affected feature. Compare what exists at each stage. The bug is usually a filter, transform, or reconstruction step that silently alters or drops data.

#### Reconstruct what the system actually saw

Don't just check what's in the database — check what the decision-maker (model, API, UI) actually received. These are often different because of:

- Filters that strip data before it reaches the decision point
- Caches returning stale data
- Reconstruction logic that assembles data differently than it was stored
- Limits or windows that exclude relevant context

If you can reconstruct the exact input the system operated on, the "wrong" behavior usually becomes the "correct" response to bad input.

#### Understand why the code exists

Before concluding something is wrong, understand why it was written that way:

- `git log --all --oneline --grep="<keyword>"` to find the commit that introduced it
- Read the commit message — it often explains the bug it was fixing
- Search the issue tracker for the ticket referenced in the commit
- Check for comments in the code explaining edge cases

The current bug is frequently collateral damage from a prior fix. Understanding the original constraint prevents you from "fixing" this bug by reintroducing the old one.

#### Diagnosis is a loop

Expect your first theory to be wrong. The diagnostic loop:

1. Form a hypothesis based on available evidence
2. Make a specific, testable prediction ("if X is the cause, then Y should be true in the data")
3. Test the prediction against the database, code, or logs
4. If it doesn't hold, abandon the hypothesis — don't patch it
5. Use what you learned to form a better hypothesis

When someone pushes back on your diagnosis, treat it as signal. Re-examine the evidence from their angle before defending your position.

#### Check for compounding factors

Bugs rarely have a single cause. Look for:

- Multiple systems interacting in unexpected ways (e.g., two crons sharing state)
- Timing-dependent behavior (race conditions, dedup windows, cache expiry)
- Stale data from a prior version of the schema or feature
- Edge cases the original author explicitly chose not to handle

#### Comment on the investigation ticket with:

- The root cause
- The full causal chain (trigger → each intermediate step → symptom)
- Any contributing factors or secondary issues discovered

### 5. Prescribe

Determine the fix. This is a separate step from diagnosis — resist the urge to propose solutions while still diagnosing.

#### Validate the fix approach with data

Before committing to a solution, quantify its impact:

- How many records/entities does this affect? Query the database.
- What are the edge cases? Check the distribution, not just one example.
- Does this fix break the thing the original code was protecting against?
- If the fix changes a filter/transform, what does the output look like with the change applied? Run the numbers.

A fix that solves the reported case but regresses 6,000 others is not a fix.

#### Understand the constraints

Every fix operates within constraints the original code was respecting:

- Performance limits (context windows, query limits, API rate limits)
- Provider requirements (API format constraints, error conditions)
- Existing invariants other code depends on

The right fix satisfies the new requirement without violating existing constraints. If a constraint must be violated, make that explicit in the ticket.

#### Create or relate tickets

- **Search the issue tracker** for existing tickets that address this root cause
- If one exists: relate the investigation ticket to it, add a comment with your findings
- If not: create a new ticket (bug or feature label) with:
  - Clear description of what to change and why
  - Technical approach (specific files, functions, and logic changes)
  - What the fix must NOT break (reference the original constraint)
  - Acceptance criteria
  - Relation to the investigation ticket

### 6. Report

Respond to the reporter with:
- Confirmation of the issue
- Brief explanation of root cause (non-technical if the reporter isn't technical)
- Links to the investigation ticket and fix ticket

## Principles

### Validate before documenting
Don't create tickets for unconfirmed issues. The validation step exists to prevent noise.

### Separate problem from solution
The investigation ticket describes the problem. The fix ticket describes the solution. Keep them distinct. This prevents scope creep and makes it possible to relate multiple investigations to the same fix.

### Follow the data
Every claim in the investigation should be backed by evidence — a query result, a log entry, a code path. "The model probably did X" is not a diagnosis. "The model received messages A, B, C because filter Y stripped message D" is.

### Check for prior art
Before creating fix tickets, search the issue tracker. Many bugs are symptoms of known issues, regressions from prior fixes, or duplicates. Relating investigations to existing tickets is more valuable than creating duplicates.

### Question your assumptions
The most common investigation failure is anchoring on the first plausible theory. When someone pushes back on your diagnosis, treat it as signal — re-examine the evidence. The fix for the last bug may be the cause of this one.

### Fixes have constraints
The code you're changing was written for a reason. Understand that reason before changing it. The best fix satisfies the new requirement without violating the original constraint. If that's impossible, document the tradeoff explicitly.
