#!/usr/bin/env bun
/**
 * Linear CLI — powered by @linear/sdk
 * Usage: bun linear.ts <command> [args...]
 */

import { LinearClient, LinearDocument } from "@linear/sdk";

const apiKey = process.env.LINEAR_API_KEY;
if (!apiKey) {
  console.error("ERROR: LINEAR_API_KEY not set");
  process.exit(1);
}

const linear = new LinearClient({ apiKey });
const DEFAULT_TEAM = process.env.LINEAR_DEFAULT_TEAM ?? "DOMA";

const [, , cmd = "help", ...args] = process.argv;

// ── helpers ──────────────────────────────────────────────────────────────────

async function getTeamId(key: string = DEFAULT_TEAM): Promise<string> {
  const teams = await linear.teams();
  const team = teams.nodes.find((t) => t.key === key);
  if (!team) {
    const keys = teams.nodes.map((t) => t.key).join(", ");
    throw new Error(`Team "${key}" not found. Available: ${keys}`);
  }
  return team.id;
}

async function resolveIssue(identifier: string) {
  const parts = identifier.toUpperCase().split("-");
  const teamKey = parts[0];
  const num = parseInt(parts[1] ?? "");
  if (!teamKey || isNaN(num)) throw new Error(`Invalid issue identifier: ${identifier}`);
  const result = await linear.issues({
    filter: { number: { eq: num }, team: { key: { eq: teamKey } } },
  });
  const issue = result.nodes[0];
  if (!issue) throw new Error(`Issue ${identifier} not found`);
  return issue;
}

async function resolveUser(name: string) {
  const users = await linear.users({ filter: { name: { containsIgnoreCase: name } } });
  const user = users.nodes[0];
  if (!user) throw new Error(`User "${name}" not found`);
  return user;
}

async function resolveLabel(name: string) {
  const labels = await linear.issueLabels({ filter: { name: { containsIgnoreCase: name } } });
  const label = labels.nodes[0];
  if (!label) throw new Error(`Label "${name}" not found`);
  return label;
}

function priorityLabel(p: number) {
  return ["None", "Urgent", "High", "Medium", "Low"][p] ?? "Unknown";
}

function priorityNum(name: string): number {
  const map: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4, none: 0 };
  const n = map[name.toLowerCase()];
  if (n === undefined) throw new Error(`Unknown priority: ${name}. Use: urgent|high|medium|low|none`);
  return n;
}

async function getStateId(teamId: string, stateName: string): Promise<string> {
  const aliases: Record<string, string> = {
    todo: "Todo",
    progress: "In Progress",
    "in-progress": "In Progress",
    review: "In Review",
    "in-review": "In Review",
    done: "Done",
    blocked: "Blocked",
    backlog: "Backlog",
    cancelled: "Cancelled",
    canceled: "Cancelled",
  };
  const resolved = aliases[stateName.toLowerCase()] ?? stateName;
  const states = await linear.workflowStates({
    filter: { team: { id: { eq: teamId } }, name: { eq: resolved } },
  });
  const state = states.nodes[0];
  if (!state) throw new Error(`State "${stateName}" not found for team`);
  return state.id;
}

function formatIssue(i: { identifier: string; title: string; state?: { name: string } | null; priority: number; assignee?: { name: string } | null }) {
  const pri = priorityLabel(i.priority);
  const state = i.state?.name ?? "?";
  const who = i.assignee?.name ? ` → ${i.assignee.name}` : "";
  return `[${pri}] ${i.identifier}: ${i.title} (${state})${who}`;
}

// ── issue commands ───────────────────────────────────────────────────────────

async function cmdMyIssues() {
  const me = await linear.viewer;
  const issues = await me.assignedIssues({
    filter: { state: { type: { nin: ["completed", "canceled"] } } },
    first: 25,
  });
  if (!issues.nodes.length) { console.log("No open assigned issues."); return; }
  for (const i of issues.nodes) {
    const state = await i.state;
    const assignee = await i.assignee;
    console.log(formatIssue({ ...i, state, assignee }));
  }
}

async function cmdTeam(teamKey?: string) {
  const teamId = await getTeamId(teamKey);
  const team = await linear.team(teamId);
  const issues = await team.issues({
    filter: { state: { type: { nin: ["completed", "canceled"] } } },
    first: 30,
  });
  if (!issues.nodes.length) { console.log("No open issues."); return; }
  for (const i of issues.nodes) {
    const state = await i.state;
    const assignee = await i.assignee;
    console.log(formatIssue({ ...i, state, assignee }));
  }
}

async function cmdIssue(identifier: string) {
  if (!identifier) throw new Error("Usage: issue <TEAM-123>");
  const i = await resolveIssue(identifier);
  const [state, assignee, project, team, comments, labels, relations, inverseRelations, attachments] = await Promise.all([
    i.state,
    i.assignee,
    i.project,
    i.team,
    i.comments({ first: 5 }),
    i.labels(),
    i.relations(),
    i.inverseRelations(),
    i.attachments(),
  ]);
  console.log(`\n${i.identifier}: ${i.title}`);
  console.log(`State: ${state?.name ?? "?"} | Priority: ${priorityLabel(i.priority)} | Assignee: ${assignee?.name ?? "Unassigned"}`);
  console.log(`Project: ${project?.name ?? "None"} | Team: ${team?.name ?? "?"}`);
  if (labels.nodes.length) {
    console.log(`Labels: ${labels.nodes.map((l) => l.name).join(", ")}`);
  }
  console.log(`Created: ${i.createdAt.toISOString().split("T")[0]}${i.dueDate ? ` | Due: ${i.dueDate}` : ""}`);
  console.log(`URL: ${i.url}`);
  if (i.description) console.log(`\n${i.description}`);
  if (relations.nodes.length || inverseRelations.nodes.length) {
    console.log("\n─── Relations ───");
    for (const r of relations.nodes) {
      const related = await r.relatedIssue;
      console.log(`  ${r.type} → ${related?.identifier}: ${related?.title}`);
    }
    for (const r of inverseRelations.nodes) {
      const source = await r.issue;
      console.log(`  ${r.type} ← ${source?.identifier}: ${source?.title}`);
    }
  }
  if (attachments.nodes.length) {
    console.log("\n─── Attachments ───");
    for (const a of attachments.nodes) {
      console.log(`  ${a.title} — ${a.url}`);
    }
  }
  if (comments.nodes.length) {
    console.log("\n─── Comments ───");
    for (const c of comments.nodes) {
      const user = await c.user;
      console.log(`[${user?.name ?? "?"}]: ${c.body}`);
    }
  }
}

async function cmdCreate(title: string, description: string | undefined, opts: Record<string, string>) {
  if (!title) throw new Error("Usage: create <title> [description] [--team KEY] [--priority P] [--status S] [--assignee USER] [--label LABEL] [--due DATE]");
  const teamId = await getTeamId(opts.team);
  const input: Record<string, unknown> = { teamId, title, description };
  if (opts.priority) input.priority = priorityNum(opts.priority);
  if (opts.status) input.stateId = await getStateId(teamId, opts.status);
  if (opts.assignee) input.assigneeId = (await resolveUser(opts.assignee)).id;
  if (opts.label) input.labelIds = [(await resolveLabel(opts.label)).id];
  if (opts.due) input.dueDate = opts.due;
  const result = await linear.createIssue(input as Parameters<typeof linear.createIssue>[0]);
  const issue = await result.issue;
  if (!issue) throw new Error("Issue creation failed");
  console.log(`Created: ${issue.identifier} — ${issue.title}\n${issue.url}`);
}

async function cmdComment(identifier: string, body: string) {
  if (!identifier || !body) throw new Error("Usage: comment <TEAM-123> <text>");
  const issue = await resolveIssue(identifier);
  await linear.createComment({ issueId: issue.id, body });
  console.log(`Comment added to ${identifier}`);
}

async function cmdStatus(identifier: string, stateName: string) {
  if (!identifier || !stateName) throw new Error("Usage: status <TEAM-123> <todo|progress|review|done|blocked|backlog>");
  const issue = await resolveIssue(identifier);
  const team = await issue.team;
  const stateId = await getStateId(team!.id, stateName);
  await linear.updateIssue(issue.id, { stateId });
  const updated = await resolveIssue(identifier);
  const state = await updated.state;
  console.log(`Updated ${identifier} → ${state?.name}`);
}

async function cmdPriority(identifier: string, priorityName: string) {
  if (!identifier || !priorityName) throw new Error("Usage: priority <TEAM-123> <urgent|high|medium|low|none>");
  const issue = await resolveIssue(identifier);
  const priority = priorityNum(priorityName);
  await linear.updateIssue(issue.id, { priority });
  console.log(`Updated ${identifier} → ${priorityLabel(priority)}`);
}

async function cmdAssign(identifier: string, userName: string) {
  if (!identifier || !userName) throw new Error("Usage: assign <TEAM-123> <username>");
  const issue = await resolveIssue(identifier);
  const user = await resolveUser(userName);
  await linear.updateIssue(issue.id, { assigneeId: user.id });
  console.log(`Assigned ${identifier} → ${user.name}`);
}

async function cmdUpdate(identifier: string, opts: Record<string, string>) {
  if (!identifier) throw new Error("Usage: update <TEAM-123> --title '...' --description '...' --priority high --status todo --assignee USER --label LABEL --due DATE");
  const issue = await resolveIssue(identifier);
  const input: Record<string, unknown> = {};
  if (opts.title) input.title = opts.title;
  if (opts.description) input.description = opts.description;
  if (opts.priority) input.priority = priorityNum(opts.priority);
  if (opts.status) {
    const team = await issue.team;
    input.stateId = await getStateId(team!.id, opts.status);
  }
  if (opts.assignee) input.assigneeId = (await resolveUser(opts.assignee)).id;
  if (opts.label) input.labelIds = [(await resolveLabel(opts.label)).id];
  if (opts.due) input.dueDate = opts.due;
  await linear.updateIssue(issue.id, input as Parameters<typeof linear.updateIssue>[1]);
  console.log(`Updated ${identifier}`);
}

async function cmdSearch(query: string) {
  if (!query) throw new Error("Usage: search <query>");
  const results = await linear.issueSearch({ query, first: 20 });
  if (!results.nodes.length) { console.log("No results."); return; }
  for (const i of results.nodes) {
    const state = await i.state;
    const assignee = await i.assignee;
    console.log(formatIssue({ ...i, state, assignee }));
  }
}

async function cmdArchive(identifier: string) {
  if (!identifier) throw new Error("Usage: archive <TEAM-123>");
  const issue = await resolveIssue(identifier);
  await linear.archiveIssue(issue.id);
  console.log(`Archived ${identifier}`);
}

async function cmdUnarchive(identifier: string) {
  if (!identifier) throw new Error("Usage: unarchive <TEAM-123>");
  const issue = await resolveIssue(identifier);
  await linear.unarchiveIssue(issue.id);
  console.log(`Unarchived ${identifier}`);
}

async function cmdDelete(identifier: string) {
  if (!identifier) throw new Error("Usage: delete <TEAM-123>");
  const issue = await resolveIssue(identifier);
  await linear.deleteIssue(issue.id);
  console.log(`Deleted ${identifier}`);
}

async function cmdRelate(fromId: string, toId: string, relationType: string) {
  if (!fromId || !toId || !relationType) throw new Error("Usage: relate <ISSUE-1> <ISSUE-2> <blocks|relates-to|duplicates>");
  const issue = await resolveIssue(fromId);
  const related = await resolveIssue(toId);
  const typeMap: Record<string, string> = {
    blocks: "blocks",
    "relates-to": "related",
    related: "related",
    duplicates: "duplicate",
    duplicate: "duplicate",
  };
  const type = typeMap[relationType.toLowerCase()];
  if (!type) throw new Error(`Unknown relation type: ${relationType}. Use: blocks|relates-to|duplicates`);
  await linear.createIssueRelation({ issueId: issue.id, relatedIssueId: related.id, type: type as any });
  console.log(`${fromId} ${relationType} ${toId}`);
}

// ── cycle commands ───────────────────────────────────────────────────────────

async function cmdCycles(teamKey?: string) {
  const teamId = await getTeamId(teamKey);
  const team = await linear.team(teamId);
  const cycles = await team.cycles({ first: 20 });
  if (!cycles.nodes.length) { console.log("No cycles."); return; }
  for (const c of cycles.nodes) {
    const start = c.startsAt.toISOString().split("T")[0];
    const end = c.endsAt.toISOString().split("T")[0];
    const pct = Math.round(c.progress * 100);
    const badge = c.isActive ? " [ACTIVE]" : c.isFuture ? " [FUTURE]" : "";
    console.log(`#${c.number}${c.name ? ` ${c.name}` : ""} (${start} → ${end}) — ${pct}%${badge}`);
  }
}

async function cmdCycleCurrent(teamKey?: string) {
  const teamId = await getTeamId(teamKey);
  const team = await linear.team(teamId);
  const cycles = await team.cycles({ filter: { isActive: { eq: true } }, first: 1 });
  const cycle = cycles.nodes[0];
  if (!cycle) { console.log("No active cycle."); return; }
  const start = cycle.startsAt.toISOString().split("T")[0];
  const end = cycle.endsAt.toISOString().split("T")[0];
  const pct = Math.round(cycle.progress * 100);
  console.log(`\nCycle #${cycle.number}${cycle.name ? ` — ${cycle.name}` : ""}`);
  console.log(`${start} → ${end} | ${pct}% complete\n`);
  const issues = await cycle.issues({ first: 50 });
  if (!issues.nodes.length) { console.log("No issues in this cycle."); return; }
  for (const i of issues.nodes) {
    const state = await i.state;
    const assignee = await i.assignee;
    console.log(formatIssue({ ...i, state, assignee }));
  }
}

// ── label commands ───────────────────────────────────────────────────────────

async function cmdLabels(teamKey?: string) {
  if (teamKey) {
    const teamId = await getTeamId(teamKey);
    const team = await linear.team(teamId);
    const labels = await team.labels({ first: 50 });
    if (!labels.nodes.length) { console.log("No labels."); return; }
    for (const l of labels.nodes) {
      console.log(`${l.color ?? "—"} ${l.name}${l.description ? ` — ${l.description}` : ""}`);
    }
  } else {
    const labels = await linear.issueLabels({ first: 50 });
    if (!labels.nodes.length) { console.log("No labels."); return; }
    for (const l of labels.nodes) {
      const parent = await l.parent;
      const group = parent ? ` (${parent.name})` : l.isGroup ? " [group]" : "";
      console.log(`${l.color ?? "—"} ${l.name}${group}${l.description ? ` — ${l.description}` : ""}`);
    }
  }
}

async function cmdLabelCreate(name: string, opts: Record<string, string>) {
  if (!name) throw new Error("Usage: label-create <name> [--color HEX] [--description TEXT] [--team KEY]");
  const input: Record<string, unknown> = { name };
  if (opts.color) input.color = opts.color;
  if (opts.description) input.description = opts.description;
  if (opts.team) input.teamId = await getTeamId(opts.team);
  const result = await linear.createIssueLabel(input as Parameters<typeof linear.createIssueLabel>[0]);
  const label = await result.issueLabel;
  console.log(`Created label: ${label?.name} (${label?.color ?? "no color"})`);
}

// ── document commands ────────────────────────────────────────────────────────

async function cmdDocs(opts: Record<string, string>) {
  const docs = await linear.documents({ first: 20 });
  if (!docs.nodes.length) { console.log("No documents."); return; }
  for (const d of docs.nodes) {
    const creator = await d.creator;
    const project = await d.project;
    const date = d.createdAt.toISOString().split("T")[0];
    const proj = project ? ` [${project.name}]` : "";
    console.log(`${d.title}${proj} — by ${creator?.name ?? "?"} (${date})`);
    console.log(`  ${d.url}`);
  }
}

async function cmdDoc(id: string) {
  if (!id) throw new Error("Usage: doc <DOC_ID>");
  const doc = await linear.document(id);
  const [creator, project] = await Promise.all([doc.creator, doc.project]);
  console.log(`\n${doc.title}`);
  console.log(`By: ${creator?.name ?? "?"} | Project: ${project?.name ?? "None"}`);
  console.log(`Created: ${doc.createdAt.toISOString().split("T")[0]}`);
  console.log(`URL: ${doc.url}`);
  if (doc.content) {
    console.log(`\n${doc.content}`);
  }
}

async function cmdDocCreate(title: string, opts: Record<string, string>) {
  if (!title) throw new Error("Usage: doc-create <title> [--content MARKDOWN] [--project PROJECT_ID]");
  const input: Record<string, unknown> = { title };
  if (opts.content) input.content = opts.content;
  if (opts.project) input.projectId = opts.project;
  const result = await linear.createDocument(input as Parameters<typeof linear.createDocument>[0]);
  const doc = await result.document;
  console.log(`Created: ${doc?.title}\n${doc?.url}`);
}

// ── attachment commands ──────────────────────────────────────────────────────

async function cmdAttachments(identifier: string) {
  if (!identifier) throw new Error("Usage: attachments <TEAM-123>");
  const issue = await resolveIssue(identifier);
  const attachments = await issue.attachments();
  if (!attachments.nodes.length) { console.log("No attachments."); return; }
  for (const a of attachments.nodes) {
    console.log(`${a.title} — ${a.url}${a.subtitle ? ` (${a.subtitle})` : ""}`);
  }
}

async function cmdAttach(identifier: string, title: string, url: string, opts: Record<string, string>) {
  if (!identifier || !title || !url) throw new Error("Usage: attach <TEAM-123> <title> <url> [--subtitle TEXT]");
  const issue = await resolveIssue(identifier);
  await linear.createAttachment({ issueId: issue.id, title, url, subtitle: opts.subtitle });
  console.log(`Attachment "${title}" added to ${identifier}`);
}

// ── batch commands ───────────────────────────────────────────────────────────

async function cmdBatchCreate(jsonInput: string, opts: Record<string, string>) {
  if (!jsonInput) throw new Error("Usage: batch-create '<json>' [--team KEY]\nJSON: [{\"title\": \"...\", \"description?\": \"...\", \"priority?\": \"high\", \"status?\": \"todo\", \"assignee?\": \"Sam\", \"label?\": \"Bug\"}]");
  let items: Array<{ title: string; description?: string; priority?: string; status?: string; assignee?: string; label?: string }>;
  try {
    items = JSON.parse(jsonInput);
  } catch {
    const file = Bun.file(jsonInput);
    const text = await file.text();
    items = JSON.parse(text);
  }
  if (!Array.isArray(items) || !items.length) throw new Error("JSON must be a non-empty array of issue objects");

  const teamId = await getTeamId(opts.team);

  // Cache lookups to avoid redundant API calls
  const userCache = new Map<string, string>();
  const labelCache = new Map<string, string>();
  const stateCache = new Map<string, string>();

  const issues: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const input: Record<string, unknown> = { teamId, title: item.title };
    if (item.description) input.description = item.description;
    if (item.priority) input.priority = priorityNum(item.priority);
    if (item.status) {
      const key = item.status.toLowerCase();
      if (!stateCache.has(key)) stateCache.set(key, await getStateId(teamId, item.status));
      input.stateId = stateCache.get(key);
    }
    if (item.assignee) {
      const key = item.assignee.toLowerCase();
      if (!userCache.has(key)) userCache.set(key, (await resolveUser(item.assignee)).id);
      input.assigneeId = userCache.get(key);
    }
    if (item.label) {
      const key = item.label.toLowerCase();
      if (!labelCache.has(key)) labelCache.set(key, (await resolveLabel(item.label)).id);
      input.labelIds = [labelCache.get(key)];
    }
    issues.push(input);
  }

  const result = await (linear as any).createIssueBatch({ issues });
  if (result.success) {
    const created = await result.issues;
    console.log(`Created ${created.length} issues:`);
    for (const issue of created) {
      console.log(`  ${issue.identifier}: ${issue.title}`);
    }
  } else {
    throw new Error("Batch creation failed");
  }
}

// ── team & project commands ──────────────────────────────────────────────────

async function cmdProjects(teamKey?: string) {
  const teamId = await getTeamId(teamKey);
  const team = await linear.team(teamId);
  const projects = await team.projects({ first: 20 });
  if (!projects.nodes.length) { console.log("No projects."); return; }
  for (const p of projects.nodes) {
    const pct = Math.round(p.progress * 100);
    console.log(`${p.name} [${p.state}] — ${pct}% complete${p.targetDate ? ` (due ${p.targetDate})` : ""}`);
  }
}

async function cmdTeams() {
  const teams = await linear.teams();
  for (const t of teams.nodes) console.log(`${t.key}\t${t.name}`);
}

async function cmdStandup() {
  const me = await linear.viewer;
  console.log("=== Daily Standup ===\n");

  const todos = await me.assignedIssues({ filter: { state: { type: { eq: "unstarted" } } }, first: 10 });
  console.log("YOUR TODOS:");
  for (const i of todos.nodes) {
    const state = await i.state;
    console.log(`  [${priorityLabel(i.priority)}] ${i.identifier}: ${i.title}`);
  }

  const inProgress = await me.assignedIssues({ filter: { state: { type: { eq: "started" } } }, first: 10 });
  console.log("\nIN PROGRESS:");
  for (const i of inProgress.nodes) {
    const state = await i.state;
    console.log(`  ${i.identifier}: ${i.title} (${state?.name})`);
  }

  const blocked = await linear.issues({
    filter: { state: { name: { in: ["Blocked", "Paused"] } } },
    first: 10,
  });
  console.log("\nBLOCKED (team-wide):");
  for (const i of blocked.nodes) {
    const assignee = await i.assignee;
    console.log(`  ${i.identifier}: ${i.title} → ${assignee?.name ?? "unassigned"}`);
  }
}

// ── parse flags ───────────────────────────────────────────────────────────────

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      flags[key] = args[++i] ?? "true";
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

// ── dispatch ──────────────────────────────────────────────────────────────────

const { positional, flags } = parseFlags(args);

try {
  const p0 = positional[0] ?? "";
  const p1 = positional[1] ?? "";
  const p2 = positional[2] ?? "";

  switch (cmd) {
    // Issues
    case "my-issues":     await cmdMyIssues(); break;
    case "team":          await cmdTeam(p0 || flags.team); break;
    case "issue":         await cmdIssue(p0); break;
    case "create":        await cmdCreate(p0, p1 || undefined, flags); break;
    case "update":        await cmdUpdate(p0, flags); break;
    case "comment":       await cmdComment(p0, p1); break;
    case "status":        await cmdStatus(p0, p1); break;
    case "priority":      await cmdPriority(p0, p1); break;
    case "assign":        await cmdAssign(p0, p1); break;
    case "search":        await cmdSearch(positional.join(" ")); break;
    case "archive":       await cmdArchive(p0); break;
    case "unarchive":     await cmdUnarchive(p0); break;
    case "delete":        await cmdDelete(p0); break;
    case "relate":        await cmdRelate(p0, p1, p2); break;
    case "batch-create":  await cmdBatchCreate(p0, flags); break;

    // Cycles
    case "cycles":        await cmdCycles(p0 || flags.team); break;
    case "cycle-current": await cmdCycleCurrent(p0 || flags.team); break;

    // Labels
    case "labels":        await cmdLabels(p0 || flags.team); break;
    case "label-create":  await cmdLabelCreate(p0, flags); break;

    // Documents
    case "docs":          await cmdDocs(flags); break;
    case "doc":           await cmdDoc(p0); break;
    case "doc-create":    await cmdDocCreate(p0, flags); break;

    // Attachments
    case "attachments":   await cmdAttachments(p0); break;
    case "attach":        await cmdAttach(p0, p1, p2, flags); break;

    // Teams & projects
    case "teams":         await cmdTeams(); break;
    case "projects":      await cmdProjects(p0 || flags.team); break;
    case "standup":       await cmdStandup(); break;

    default:
      console.log(`Linear CLI — @linear/sdk

Issues:
  my-issues                        Your open assigned issues
  team [TEAM_KEY]                  All open issues for a team (default: ${DEFAULT_TEAM})
  issue <TEAM-123>                 Issue details + relations + attachments + comments
  create <title> [desc] [--team] [--priority] [--status] [--assignee] [--label] [--due]
  update <TEAM-123> [--title] [--description] [--priority] [--status] [--assignee] [--label] [--due]
  comment <TEAM-123> <text>        Add comment
  status <TEAM-123> <state>        Update status (todo|progress|review|done|blocked|backlog)
  priority <TEAM-123> <level>      Set priority (urgent|high|medium|low|none)
  assign <TEAM-123> <user>         Assign to user
  search <query>                   Search issues
  archive <TEAM-123>               Archive issue
  unarchive <TEAM-123>             Unarchive issue
  delete <TEAM-123>                Delete issue (permanent)
  relate <ISS-1> <ISS-2> <type>   Relate issues (blocks|relates-to|duplicates)
  batch-create <json> [--team]     Create multiple issues from JSON array or file

Cycles:
  cycles [TEAM_KEY]                List cycles for a team
  cycle-current [TEAM_KEY]         Show current active cycle with issues

Labels:
  labels [TEAM_KEY]                List labels (team-scoped or workspace)
  label-create <name> [--color HEX] [--description TEXT] [--team KEY]

Documents:
  docs                             List documents
  doc <DOC_ID>                     View document
  doc-create <title> [--content MD] [--project PROJECT_ID]

Attachments:
  attachments <TEAM-123>           List attachments on an issue
  attach <TEAM-123> <title> <url> [--subtitle TEXT]

Teams & Projects:
  teams                            List all teams
  projects [TEAM_KEY]              List projects with progress
  standup                          Daily standup summary`);
  }
} catch (err: unknown) {
  console.error("ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
}
