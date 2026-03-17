#!/usr/bin/env bun

// Re-exec as non-root user if running as root
import { userInfo } from "os";
if (userInfo().uid === 0) {
  const proc = Bun.spawn(["sudo", "-u", "ralph", "-E", "bun", ...process.argv.slice(1)], {
    stdout: "inherit",
    stderr: "inherit",
    cwd: process.cwd(),
  });
  process.exit(await proc.exited);
}

const MAX_ITERATIONS = parseInt(process.argv[2] || "20", 10);
const POLL_INTERVAL = 60_000; // 1 minute between polls
const BUGBOT_CHECK_NAME = "Cursor Bugbot";

// --- GitHub helpers ---

async function run(cmd) {
  const proc = Bun.spawn(["bash", "-c", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { stdout: stdout.trim(), code };
}

async function getPrNumber() {
  const { stdout, code } = await run("gh pr view --json number --jq .number");
  if (code !== 0) return null;
  return parseInt(stdout, 10);
}

async function getChecksStatus() {
  const { stdout } = await run(
    `gh pr checks --json name,state,bucket`
  );
  if (!stdout) return { allDone: false, anyChecks: false, anyRunning: true };
  try {
    const checks = JSON.parse(stdout);
    const anyRunning = checks.some(
      (c) => c.state === "PENDING" || c.state === "IN_PROGRESS" || c.bucket === "pending"
    );
    return {
      allDone: !anyRunning,
      anyChecks: checks.length > 0,
      anyRunning,
    };
  } catch {
    return { allDone: false, anyChecks: false, anyRunning: true };
  }
}

async function getCurrentHeadSha() {
  const { stdout } = await run("git rev-parse HEAD");
  return stdout;
}

async function getPrHeadSha() {
  const { stdout } = await run("gh pr view --json headRefOid --jq .headRefOid");
  return stdout;
}

async function getUnresolvedBugbotComments() {
  const { stdout: repoInfo } = await run(
    "gh repo view --json owner,name --jq '.owner.login + \"/\" + .name'"
  );
  const [owner, repo] = repoInfo.split("/");
  const prNumber = await getPrNumber();
  if (!prNumber) return [];

  const query = `{
    repository(owner: "${owner}", name: "${repo}") {
      pullRequest(number: ${prNumber}) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes {
                author { login }
                body
                path
                line
              }
            }
          }
        }
      }
    }
  }`;

  const { stdout } = await run(
    `gh api graphql -f query='${query}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | select(.comments.nodes[0].author.login == "cursor") | {threadId: .id, path: .comments.nodes[0].path, line: .comments.nodes[0].line, body: .comments.nodes[0].body}'`
  );

  if (!stdout) return [];
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function extractBugDescription(body) {
  const match = body.match(/<!-- DESCRIPTION START -->\n([\s\S]*?)\n<!-- DESCRIPTION END -->/);
  return match ? match[1].trim() : body.slice(0, 200);
}

// --- Claude runner (same pattern as ralph.js) ---

async function runClaude(prompt) {
  const { ANTHROPIC_API_KEY, ...env } = process.env;
  const proc = Bun.spawn(
    [
      "claude",
      "--dangerously-skip-permissions",
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
    ],
    { stdout: "pipe", stderr: "pipe", env }
  );

  let resultText = "";
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseLine = (line) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      if (event.type === "assistant" && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === "tool_use") {
            const input = block.input || {};
            const detail =
              input.command?.slice(0, 100) ||
              input.file_path ||
              input.pattern ||
              "";
            console.log(`  🔧 ${block.name}${detail ? `: ${detail}` : ""}`);
          }
          if (block.type === "text" && block.text) {
            console.log(`  💬 ${block.text.slice(0, 200)}`);
          }
        }
      }
      if (event.type === "result") {
        resultText = event.result || "";
        console.log(
          `\n  ⏱  ${(event.duration_ms / 1000).toFixed(0)}s | $${event.total_cost_usd?.toFixed(3) || "?"}`
        );
      }
    } catch {}
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) parseLine(line);
  }
  if (buffer.trim()) parseLine(buffer);

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`  ❌ Claude exited with code ${exitCode}`);
    if (stderr.trim()) console.error(`  ${stderr.trim().slice(0, 300)}`);
  }
  return resultText;
}

// --- Main loop ---

console.log("🐛 Starting Bug Bot fix loop");
console.log(`   Max iterations: ${MAX_ITERATIONS}`);
console.log("");

const prNumber = await getPrNumber();
if (!prNumber) {
  console.error("❌ No PR found for current branch. Push and create a PR first.");
  process.exit(1);
}
console.log(`   PR #${prNumber}\n`);

async function waitForCheck(expectedSha) {
  const maxWait = 20 * 60_000; // 20 min
  const interval = 30_000;    // 30s
  const maxPolls = Math.ceil(maxWait / interval);
  let sawPending = !expectedSha; // if no expected SHA, don't require PENDING phase

  for (let s = 1; s <= maxPolls; s++) {
    // If we expect a specific commit, wait until the PR reflects it
    if (expectedSha) {
      const prSha = await getPrHeadSha();
      if (prSha !== expectedSha) {
        console.log(`  ⏳ PR still on old commit, waiting for ${expectedSha.slice(0, 7)}… (${s}/${maxPolls})`);
        await Bun.sleep(interval);
        continue;
      }
    }

    const status = await getChecksStatus();
    if (!status.anyChecks) {
      sawPending = true; // no checks yet — new run hasn't started
      console.log(`  ⏳ No checks found yet (${s}/${maxPolls})…`);
    } else if (status.anyRunning) {
      sawPending = true; // checks are still running
      console.log(`  ⏳ Checks still running (${s}/${maxPolls})…`);
    } else if (!sawPending) {
      // All checks done but we never saw them pending — stale results from old commit
      console.log(`  ⏳ Stale check results, waiting for new run… (${s}/${maxPolls})`);
    } else {
      console.log("  ✓ All checks have finished");
      return status;
    }
    await Bun.sleep(interval);
  }
  return null; // timed out
}

let expectedSha = null; // first iteration: accept whatever check is current
let iteration = 0;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  console.log(`\n═══ Iteration ${iteration}/${MAX_ITERATIONS} ═══\n`);

  // 1. Wait for Bug Bot to appear and finish (on the expected commit)
  const check = await waitForCheck(expectedSha);
  if (!check) {
    console.error("❌ Timed out waiting for checks to complete");
    process.exit(1);
  }

  // 2. Get unresolved comments
  const comments = await getUnresolvedBugbotComments();
  if (comments.length === 0) {
    console.log("  ✅ All clean — no unresolved Bug Bot comments!");
    process.exit(0);
  }

  console.log(`  📝 ${comments.length} unresolved comment(s)\n`);

  // 3. Record SHA before processing so we can detect if a push happened
  const shaBeforeProcessing = await getCurrentHeadSha();

  // 4. Process one comment at a time, each in its own Claude instance
  for (const comment of comments) {
    if (iteration > MAX_ITERATIONS) break;

    console.log(`\n  ── Bug ${iteration}/${MAX_ITERATIONS} ──`);
    console.log(`     ${comment.path}${comment.line ? `:${comment.line}` : ""}`);
    console.log(`     ${extractBugDescription(comment.body).slice(0, 100)}\n`);

    const prompt = `You are reviewing a single Cursor Bug Bot comment on a PR. Evaluate it and decide whether to FIX or DISMISS it.

Thread ID: ${comment.threadId}
File: ${comment.path}${comment.line ? ` (line ${comment.line})` : ""}
Issue: ${extractBugDescription(comment.body)}

Steps:
1. Read the file referenced and surrounding context
2. Evaluate the issue — is it a real bug, or a false positive?
3. If VALID: implement the fix
4. If INVALID (false positive, already handled, not applicable): reply to the thread explaining why, then resolve it:
   gh api graphql -f query='mutation { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: "${comment.threadId}", body: "Dismissed: [brief reason]"}) { comment { id } } }'
   gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "${comment.threadId}"}) { thread { isResolved } } }'

After processing:
1. Run typecheck to verify (if a fix was made)
2. git add -A && git commit -m "fix: ${comment.path}${comment.line ? `:${comment.line}` : ""} — address Bug Bot comment" (if a fix was made)
3. Do NOT push — the outer loop will push all fixes at once`;

    await runClaude(prompt);
    iteration++;
  }

  // 5. Push once after all comments in this batch are processed
  const shaAfterProcessing = await getCurrentHeadSha();
  if (shaAfterProcessing !== shaBeforeProcessing) {
    console.log("\n  📤 Pushing all fixes…");
    const { code } = await run("git push");
    if (code !== 0) {
      console.error("  ❌ git push failed");
      process.exit(1);
    }
    expectedSha = shaAfterProcessing;
    console.log(`  ⏳ Waiting for Bug Bot to run on ${expectedSha.slice(0, 7)}…`);
  } else {
    expectedSha = null; // no fixes made, don't wait for a new check
    console.log("\n  ℹ️  No fixes made — re-checking comments…");
  }
}

console.log("\n⚠️ Max iterations reached — some comments may remain unresolved");
process.exit(1);
