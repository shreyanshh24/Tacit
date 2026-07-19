// Task prompts for the three autonomous agents. Each instructs `claude -p` to do
// real work with tools, then END with a single fenced ```json block the runner
// parses to post results and update the run record.

const JSON_CONTRACT = `IMPORTANT OUTPUT FORMAT: After you finish the work, your FINAL message must be ONLY a single \`\`\`json fenced code block and nothing else — no prose before or after it. Put your full written report/markdown inside the "comment" field of that JSON. Do not write the report outside the JSON block.`;

export function scrumPrompt(opts: {
  transcript: string;
  ticketKey: string;
  transcriptName: string;
}): string {
  return `You are the Daily Scrum agent for the CRM360 project. You have a working clone of the repository as your current directory (read its docs/ and code to ground yourself).

Below is today's standup transcript ("${opts.transcriptName}"). Read it, then cross-check what was discussed against the repository (branches/docs/code you can see). Focus on work relevant to Jira ticket ${opts.ticketKey}.

Produce a concise progress update comment to post on ${opts.ticketKey}: what moved forward, blockers raised, and any decision or risk mentioned. Ground claims in the transcript and repo; do not invent status.

TRANSCRIPT:
"""
${opts.transcript.slice(0, 8000)}
"""

${JSON_CONTRACT}
The JSON must be:
{
  "summary": "one-line summary of the standup as it relates to ${opts.ticketKey}",
  "comment": "the markdown comment to post on the Jira ticket"
}`;
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
2. Install dependencies if needed and RUN the test suite (e.g. \`npm install\` then \`npx jest\`). If useful, add or extend test cases that exercise the ticket's behaviour, and run them.
3. Judge whether the ticket's requirements are met based on ACTUAL test results (not assumptions).

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
