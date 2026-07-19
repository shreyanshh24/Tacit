// Task prompts for the three autonomous agents. Each instructs `claude -p` to do
// real work with tools, then END with a single fenced ```json block the runner
// parses to post results and update the run record.

const JSON_CONTRACT = `IMPORTANT OUTPUT FORMAT: After you finish the work, your FINAL message must be ONLY a single \`\`\`json fenced code block and nothing else — no prose before or after it. Put your full written report/markdown inside the "comment" field of that JSON. Do not write the report outside the JSON block.`;

export function scrumPrompt(opts: {
  transcript: string;
  transcriptName: string;
  tickets: { key: string; text: string }[];
}): string {
  const ticketBlock = opts.tickets
    .map(
      (t) =>
        `### ${t.key}\n${(t.text || "(no Jira context available)").slice(0, 1500)}`
    )
    .join("\n\n");
  const keyList = opts.tickets.map((t) => t.key).join(", ");

  return `You are the Daily Scrum agent for the CRM360 project. You have a working clone of the repository as your current directory (read its docs/ and code to ground yourself).

Below is today's standup transcript ("${opts.transcriptName}"). It references MULTIPLE Jira tickets. The tickets mentioned — and the ONLY ones you may update — are: ${keyList}.

For EACH of those tickets, produce a concise progress-update comment based ONLY on what the transcript says about that specific ticket (cross-checked against the repo where relevant): what moved forward, blockers raised, decisions or risks. Do NOT invent status, and do NOT produce an update for a ticket the transcript says nothing about — skip it instead.

TICKETS (with their current Jira context):
"""
${ticketBlock}
"""

TRANSCRIPT:
"""
${opts.transcript.slice(0, 8000)}
"""

${JSON_CONTRACT}
The JSON must be:
{
  "summary": "one-line summary of the standup across all tickets",
  "updates": [
    { "ticketKey": "${opts.tickets[0]?.key ?? "CRM360-1"}", "summary": "one-line status for this ticket", "comment": "the markdown comment to post on this ticket" }
  ]
}
Only include a ticket in "updates" if the transcript actually discusses it.`;
}

export function testerPrompt(opts: {
  ticketKey: string;
  ticketText: string;
  branch: string;
}): string {
  return `You are the Tester agent for the CRM360 project. Your current directory is a fresh clone of branch "${opts.branch}". Your job: determine whether Jira ticket ${opts.ticketKey} is actually implemented and correct on this branch, by GENERATING and RUNNING tests.

Ticket ${opts.ticketKey}:
"""
${opts.ticketText.slice(0, 4000)}
"""

Steps:
1. Explore the repo (Read/Grep) to find the code relevant to this ticket.
2. Derive a list of 5–8 concrete behaviours to test from the ticket's acceptance criteria.
3. Install dependencies if needed, write/extend tests for those behaviours, and RUN them (e.g. \`npm install\` then \`npx jest\`).
4. Judge whether the ticket's requirements are met based on ACTUAL test results (not assumptions).

LIVE PROGRESS MARKERS — a non-technical dashboard renders each test as a card, so you MUST emit these markers, each on ITS OWN LINE, in your normal messages (NOT inside the final JSON):
- Once, right after step 2, list every test you will run:
  TEST_PLAN: ["Create a new contact", "Reject an invalid email address", "Find duplicate contacts", "Merge two duplicate contacts", "Only the owner can read a contact"]
  (Use short, plain-English names a non-engineer understands — describe the behaviour, not the function name.)
- Then, after you know each test's outcome, emit one line per test:
  TEST_RESULT: {"name":"Create a new contact","status":"pass","detail":"Created a contact and got back an id."}
  TEST_RESULT: {"name":"Merge two duplicate contacts","status":"fail","detail":"No merge function exists — the behaviour is not implemented."}
  The "name" MUST exactly match a name from TEST_PLAN. "status" is "pass" or "fail". "detail" is ONE short plain-English sentence. Emit a TEST_RESULT for EVERY item in TEST_PLAN.

${JSON_CONTRACT}
The JSON must be:
{
  "verdict": "pass" | "fail" | "inconclusive",
  "summary": "one-line verdict",
  "tests": "what you ran and the pass/fail counts",
  "comment": "a markdown comment to post on ${opts.ticketKey} with the verdict, evidence, and any gaps"
}`;
}

export function prSecurityPrompt(opts: {
  prNumber: number;
  branch: string;
  diff: string;
}): string {
  return `You are the PR Security agent. A pull request (#${opts.prNumber}) targets the deploy branch (main). Your current directory is a clone of the PR's head branch "${opts.branch}", so you can read full file context. Review the change for SECURITY vulnerabilities that would ship if merged.

Look for: injection (SQL/command/template), missing authentication/authorization, unsafe deserialization, secrets in code, path traversal, SSRF, weak crypto, and unvalidated input. Read the changed files for context — do not rely on the diff alone.

UNIFIED DIFF:
"""
${opts.diff.slice(0, 12000)}
"""

${JSON_CONTRACT}
The JSON must be:
{
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "summary": "one-line risk summary",
  "findings": [{ "title": "...", "severity": "...", "location": "file:function", "detail": "why it's exploitable", "fix": "recommended remediation" }],
  "comment": "a markdown security-review comment to post on the PR"
}`;
}
