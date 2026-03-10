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

async function getBugbotCheckStatus() {
  const { stdout } = await run(
    `gh pr checks --json name,state --jq '.[] | select(.name == "${BUGBOT_CHECK_NAME}") | .state'`
  );
  if (!stdout) return { running: false, passed: false, notFound: true };
  // state values: PENDING, SUCCESS, FAILURE, NEUTRAL, SKIPPED, etc.
  return {
    running: stdout === "PENDING",
    passed: stdout === "SUCCESS" || stdout === "NEUTRAL",
    notFound: false,
  };
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

async function waitForCheck() {
  const maxWait = 10 * 60_000; // 10 min
  const interval = 30_000;    // 30s
  const maxPolls = Math.ceil(maxWait / interval);

  for (let s = 1; s <= maxPolls; s++) {
    const status = await getBugbotCheckStatus();
    if (status.notFound) {
      console.log(`  ⏳ Bug Bot check not found yet (${s}/${maxPolls})…`);
    } else if (status.running) {
      console.log(`  ⏳ Bug Bot is running (${s}/${maxPolls})…`);
    } else {
      console.log("  ✓ Bug Bot has finished");
      return status;
    }
    await Bun.sleep(interval);
  }
  return null; // timed out
}

for (let i = 1; i <= MAX_ITERATIONS; i++) {
  console.log(`\n═══ Iteration ${i}/${MAX_ITERATIONS} ═══\n`);

  // 1. Wait for Bug Bot to appear and finish
  const check = await waitForCheck();
  if (!check) {
    console.error("❌ Timed out waiting for Bug Bot — is it configured for this repo?");
    process.exit(1);
  }

  // 2. Get unresolved comments
  const comments = await getUnresolvedBugbotComments();
  if (comments.length === 0) {
    console.log("  ✅ All clean — no unresolved Bug Bot comments!");
    process.exit(0);
  }

  console.log(`  📝 ${comments.length} unresolved comment(s):\n`);
  for (const c of comments) {
    console.log(`     ${c.path}${c.line ? `:${c.line}` : ""}`);
    console.log(`     ${extractBugDescription(c.body).slice(0, 100)}\n`);
  }

  // 3. Build prompt with specific comments
  const commentDetails = comments
    .map(
      (c) =>
        `Thread ID: ${c.threadId}\nFile: ${c.path}${c.line ? ` (line ${c.line})` : ""}\nIssue: ${extractBugDescription(c.body)}`
    )
    .join("\n\n");

  const prompt = `You are reviewing Cursor Bug Bot comments on a PR. Evaluate each comment and decide whether to FIX or DISMISS it.

Here are the unresolved comments:

${commentDetails}

For each comment:
1. Read the file referenced and surrounding context
2. Evaluate the issue — is it a real bug, or a false positive?
3. If VALID: implement the fix
4. If INVALID (false positive, already handled, not applicable): reply to the thread explaining why, then resolve it:
   gh api graphql -f query='mutation { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: "THREAD_ID", body: "Dismissed: [brief reason]"}) { comment { id } } }'
   gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "THREAD_ID"}) { thread { isResolved } } }'

After processing all comments:
1. Run typecheck to verify (if any fixes were made)
2. git add -A && git commit -m "fix: address Bug Bot review comments" (if any fixes were made)
3. git push (if any fixes were made)`;

  // 4. Run Claude to fix (pushes if changes made)
  await runClaude(prompt);

  // 5. Brief pause before next iteration to let new check register
  console.log("\n  ⏳ Waiting for new Bug Bot run…");
  await Bun.sleep(30_000);
}

console.log("\n⚠️ Max iterations reached — some comments may remain unresolved");
process.exit(1);
