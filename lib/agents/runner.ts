// Autonomous agent runner. Spawns `claude -p` with tools inside a prepared repo
// working directory, streams the transcript live into agent_runs.log (so the UI
// can watch it happen), parses the final JSON result, and posts the outcome to
// Jira / the PR.

import { spawn } from "child_process";
import { getDb, AgentRow } from "../db";
import {
  prepareWorkdir,
  cleanupWorkdir,
  getPRDiff,
  prComment,
  listOpenPRs,
} from "../github";
import { jiraComment, fetchJiraIssues } from "../jira";
import { latestTranscript, readTranscript } from "../transcripts";
import { parseJsonLoose } from "../llm";
import { scrumPrompt, testerPrompt, prSecurityPrompt } from "./prompts";

interface RunOutcome {
  result: unknown;
  jira_ref: string | null;
  pr_ref: string | null;
}

/**
 * A single append-only log for a run, persisted to agent_runs.log on every
 * write so the detail page can poll and render the run live. Both the phase
 * markers (from the runner) and the `claude -p` transcript share this buffer,
 * so they interleave in the order they actually happened.
 */
function makeLogger(runId: number) {
  const db = getDb();
  let buf = "";
  const persist = () => {
    try {
      db.prepare("UPDATE agent_runs SET log = ? WHERE id = ?").run(buf, runId);
    } catch {
      /* ignore */
    }
  };
  return {
    /** A high-level step marker (rendered as a heading in the UI). */
    phase(s: string) {
      buf += `\n■ ${s}\n`;
      persist();
    },
    /** A raw log line. */
    line(s: string) {
      buf += s.endsWith("\n") ? s : s + "\n";
      persist();
    },
    /** Append without forcing a trailing newline (used by the claude streamer). */
    append(s: string) {
      buf += s;
      persist();
    },
    text() {
      return buf;
    },
  };
}
type RunLogger = ReturnType<typeof makeLogger>;

type TestStatus = "pending" | "running" | "pass" | "fail";
interface TestCase {
  name: string;
  status: TestStatus;
  detail?: string;
}

/** Strip jest timing suffixes / bullets and normalize a test name for matching. */
function cleanTestName(s: string): string {
  return String(s)
    .replace(/\s*\(\d+\s*ms\)\s*$/i, "")
    .replace(/^[-•*\s]+/, "")
    .trim();
}
function normName(s: string): string {
  return cleanTestName(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Tracks individual test cases for the Tester agent so the UI can render each as
 * a live pass/fail card. The agent emits TEST_PLAN / TEST_RESULT markers; jest's
 * own ✓/✗ output is parsed as a safety net (updating existing cards only).
 */
function makeTestTracker(runId: number) {
  const db = getDb();
  const tests: TestCase[] = [];
  const persist = () => {
    try {
      db.prepare("UPDATE agent_runs SET tests_json = ? WHERE id = ?").run(
        JSON.stringify(tests),
        runId
      );
    } catch {
      /* ignore */
    }
  };
  const find = (name: string): TestCase | undefined => {
    const n = normName(name);
    if (!n) return undefined;
    return (
      tests.find((t) => normName(t.name) === n) ||
      tests.find((t) => {
        const tn = normName(t.name);
        return tn.includes(n) || n.includes(tn);
      })
    );
  };
  return {
    plan(names: unknown[]) {
      for (const raw of names) {
        const name = cleanTestName(
          typeof raw === "string" ? raw : (raw as { name?: string })?.name || ""
        );
        if (name && !find(name)) tests.push({ name, status: "pending" });
      }
      persist();
    },
    result(name: string, status: TestStatus, detail?: string) {
      let t = find(name);
      if (!t) {
        t = { name: cleanTestName(name), status };
        tests.push(t);
      }
      t.status = status;
      if (detail) t.detail = String(detail).slice(0, 200);
      persist();
    },
    running(name: string) {
      const t = find(name);
      if (t && t.status === "pending") {
        t.status = "running";
        persist();
      }
    },
    /** Scan the agent's own text for TEST_PLAN / TEST_START / TEST_RESULT markers. */
    scanText(text: string) {
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        const plan = line.match(/^TEST_PLAN:\s*(\[.*\])\s*$/i);
        if (plan) {
          try {
            const arr = JSON.parse(plan[1]);
            if (Array.isArray(arr)) this.plan(arr);
          } catch {
            /* ignore */
          }
          continue;
        }
        const start = line.match(/^TEST_START:\s*(.+)$/i);
        if (start) {
          this.running(start[1].replace(/^["']|["']$/g, ""));
          continue;
        }
        const res = line.match(/^TEST_RESULT:\s*(\{.*\})\s*$/i);
        if (res) {
          try {
            const o = JSON.parse(res[1]);
            if (o?.name && o?.status)
              this.result(o.name, o.status === "pass" ? "pass" : "fail", o.detail);
          } catch {
            /* ignore */
          }
        }
      }
    },
    /** Safety net: map jest ✓/✗ lines onto existing planned cards. */
    scanJest(text: string) {
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        let m = line.match(/^[✓✔√]\s+(.+)$/);
        if (m) {
          const t = find(m[1]);
          if (t && (t.status === "pending" || t.status === "running"))
            this.result(t.name, "pass");
          continue;
        }
        m = line.match(/^[✗✕×]\s+(.+)$/);
        if (m) {
          const t = find(m[1]);
          if (t && (t.status === "pending" || t.status === "running"))
            this.result(t.name, "fail");
        }
      }
    },
    /** Any still-unresolved cards can't stay pending once the run ends. */
    finalize(fallback: TestStatus) {
      let changed = false;
      for (const t of tests) {
        if (t.status === "pending" || t.status === "running") {
          t.status = fallback;
          changed = true;
        }
      }
      if (changed) persist();
    },
  };
}
type TestTracker = ReturnType<typeof makeTestTracker>;

/** Load an agent and merge any per-run overrides into its stored config. */
function loadAgentAndConfig(
  agentId: number,
  extra?: Record<string, unknown>
): { agent: AgentRow; config: Record<string, unknown> } {
  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as
    | AgentRow
    | undefined;
  if (!agent) throw new Error("Agent not found");
  const config = {
    ...(agent.config ? JSON.parse(agent.config) : {}),
    ...(extra || {}),
  };
  return { agent, config };
}

/** Insert a 'running' agent_runs row and return its id. */
function beginRun(
  agentId: number,
  config: Record<string, unknown>,
  trigger: string
): number {
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO agent_runs (agent_id, status, trigger, input, started_at, log) VALUES (?, 'running', ?, ?, datetime('now'), '')"
    )
    .run(agentId, trigger, JSON.stringify(config));
  return Number(res.lastInsertRowid);
}

/** Execute a run and record its terminal status. */
async function doRun(
  agent: AgentRow,
  config: Record<string, unknown>,
  runId: number
): Promise<void> {
  const db = getDb();
  const log = makeLogger(runId);
  try {
    const outcome = await execute(agent, config, log, runId);
    log.phase("Done");
    db.prepare(
      "UPDATE agent_runs SET status = 'done', finished_at = datetime('now'), result = ?, jira_ref = ?, pr_ref = ? WHERE id = ?"
    ).run(
      JSON.stringify(outcome.result),
      outcome.jira_ref,
      outcome.pr_ref,
      runId
    );
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    log.phase(`Failed: ${msg}`);
    db.prepare(
      "UPDATE agent_runs SET status = 'failed', finished_at = datetime('now'), result = ? WHERE id = ?"
    ).run(JSON.stringify({ error: msg }), runId);
  }
}

/**
 * Run an agent end-to-end and await it (used by the scheduler). Returns the run id.
 */
export async function runAgent(
  agentId: number,
  trigger: "manual" | "schedule" = "manual",
  extra?: Record<string, unknown>
): Promise<number> {
  const { agent, config } = loadAgentAndConfig(agentId, extra);
  const runId = beginRun(agentId, config, trigger);
  await doRun(agent, config, runId);
  return runId;
}

/**
 * Start a run in the background and return its id immediately, so the UI can
 * navigate to the agent's page and stream the log live via polling. Used by the
 * "Run now" endpoint and the PR watcher.
 */
export function startAgentRun(
  agentId: number,
  trigger: "manual" | "schedule" = "manual",
  extra?: Record<string, unknown>
): number {
  const { agent, config } = loadAgentAndConfig(agentId, extra);
  const runId = beginRun(agentId, config, trigger);
  doRun(agent, config, runId).catch((e) =>
    console.error(`[tacit] agent ${agentId} run ${runId} failed`, e)
  );
  return runId;
}

/** Pull Jira-style ticket keys (e.g. CRM360-22) out of free text, de-duped. */
function extractTicketKeys(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
  return Array.from(new Set(matches));
}

async function execute(
  agent: AgentRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  log: RunLogger,
  runId: number
): Promise<RunOutcome> {
  switch (agent.type) {
    case "scrum": {
      const t = config.transcriptName
        ? readTranscript(config.transcriptName)
        : latestTranscript();
      if (!t) throw new Error("No transcript found in TRANSCRIPTS_DIR.");
      log.phase(`Reading standup transcript "${t.name}"`);

      // Token filter: only touch tickets actually mentioned in the transcript.
      const keys = extractTicketKeys(t.text);
      if (!keys.length)
        throw new Error(
          "No ticket keys (e.g. CRM360-12) mentioned in the transcript."
        );
      log.line(`Detected ${keys.length} ticket(s): ${keys.join(", ")}`);

      // Fetch just those tickets for grounding context (not the whole board).
      const projectKey =
        keys[0].slice(0, keys[0].lastIndexOf("-")) || keys[0];
      let tickets: { key: string; text: string }[] = keys.map((k) => ({
        key: k,
        text: "",
      }));
      try {
        log.phase("Fetching the mentioned tickets from Jira");
        const issues = await fetchJiraIssues(projectKey);
        tickets = keys.map((k) => {
          const f = issues.find((i) => i.source_id === k);
          return { key: k, text: f ? `${f.title}\n${f.content}` : "" };
        });
      } catch {
        log.line("  (couldn't reach Jira for ticket context; using keys only)");
      }

      const workdir = await prepareWorkdir(config.branch || "main");
      try {
        log.phase("Cross-checking the standup against the repo");
        const prompt = scrumPrompt({
          transcript: t.text,
          transcriptName: t.name,
          tickets,
        });
        const result = await runClaudeAgent(prompt, workdir, log);
        const parsed = extractJson(result);
        const updates: { ticketKey?: string; comment?: string }[] = Array.isArray(
          parsed?.updates
        )
          ? parsed.updates
          : [];
        const posted: string[] = [];
        for (const u of updates) {
          const key = String(u?.ticketKey || "").trim().toUpperCase();
          const comment = String(u?.comment || "").trim();
          if (!key || !comment) continue;
          log.phase(`Posting update to ${key}`);
          try {
            await jiraComment(key, comment);
            posted.push(key);
          } catch (e) {
            log.line(`  ✖ failed to comment on ${key}: ${(e as Error).message}`);
          }
        }
        return {
          result: structuredResult(parsed, result),
          jira_ref: posted.join(", ") || null,
          pr_ref: null,
        };
      } finally {
        cleanupWorkdir(workdir);
      }
    }

    case "tester": {
      const ticketKey = String(config.ticketKey || "").trim();
      const branch = String(config.branch || "").trim();
      if (!ticketKey || !branch)
        throw new Error("Tester agent needs both branch and ticketKey.");
      const projectKey =
        ticketKey.slice(0, ticketKey.lastIndexOf("-")) || ticketKey;
      let ticketText = ticketKey;
      log.phase(`Fetching ticket ${ticketKey} from Jira`);
      try {
        const issues = await fetchJiraIssues(projectKey);
        const found = issues.find((i) => i.source_id === ticketKey);
        if (found) ticketText = `${found.title}\n\n${found.content}`;
      } catch {
        log.line("  (couldn't reach Jira; testing against the ticket key only)");
      }
      log.phase(`Cloning branch ${branch}`);
      const workdir = await prepareWorkdir(branch);
      const tracker = makeTestTracker(runId);
      try {
        log.phase("Generating and running tests for the ticket");
        const prompt = testerPrompt({ ticketKey, ticketText, branch });
        const result = await runClaudeAgent(prompt, workdir, log, tracker);
        const parsed = extractJson(result);
        const comment = resolveComment(parsed, result);
        // Resolve any card the agent left hanging, based on the overall verdict.
        tracker.finalize(parsed?.verdict === "pass" ? "pass" : "fail");
        let jira_ref: string | null = null;
        if (comment) {
          log.phase(`Posting verdict to ${ticketKey}`);
          await jiraComment(ticketKey, comment);
          jira_ref = ticketKey;
        }
        return {
          result: structuredResult(parsed, result),
          jira_ref,
          pr_ref: null,
        };
      } finally {
        cleanupWorkdir(workdir);
      }
    }

    case "pr_security": {
      const baseBranch = String(
        config.baseBranch || config.branch || "main"
      ).trim();
      let prNumber = Number(config.prNumber) || 0;
      let headBranch = "";

      log.phase(`Looking for open PRs targeting "${baseBranch}"`);
      const prs = await listOpenPRs();
      if (!prNumber) {
        const matching = prs.filter((p) => (p.baseRefName || "") === baseBranch);
        if (!matching.length)
          throw new Error(`No open pull request targeting "${baseBranch}".`);
        // Newest PR (highest number) if several target the branch.
        const chosen = matching.reduce((a, b) => (b.number > a.number ? b : a));
        prNumber = chosen.number;
        headBranch = chosen.headRefName;
        log.line(`Selected PR #${prNumber} — ${chosen.title}`);
      } else {
        const pr = prs.find((p) => p.number === prNumber);
        if (pr) headBranch = pr.headRefName;
        log.line(`Reviewing PR #${prNumber}${pr ? ` — ${pr.title}` : ""}`);
      }

      log.phase(`Fetching the diff for PR #${prNumber}`);
      const diff = await getPRDiff(prNumber);
      log.phase(`Cloning PR branch ${headBranch || baseBranch}`);
      const workdir = await prepareWorkdir(headBranch || baseBranch);
      try {
        log.phase("Reviewing the change for security vulnerabilities");
        const prompt = prSecurityPrompt({
          prNumber,
          branch: headBranch || baseBranch,
          diff,
        });
        const result = await runClaudeAgent(prompt, workdir, log);
        const parsed = extractJson(result);
        const comment = resolveComment(parsed, result);
        let pr_ref: string | null = null;
        if (comment) {
          log.phase(`Posting the security review to PR #${prNumber}`);
          await prComment(prNumber, comment);
          pr_ref = String(prNumber);
        }
        return {
          result: structuredResult(parsed, result),
          jira_ref: null,
          pr_ref,
        };
      } finally {
        cleanupWorkdir(workdir);
      }
    }

    default:
      throw new Error(`Unknown agent type: ${agent.type}`);
  }
}

/** Spawn claude -p (agentic, tools on) in `cwd`; stream the log live. */
function runClaudeAgent(
  prompt: string,
  cwd: string,
  log: RunLogger,
  tracker?: TestTracker
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--max-turns",
      "40",
    ];
    const child = spawn(process.env.CLAUDE_BIN || "claude", args, {
      cwd,
      env: process.env,
    });

    let buf = "";
    let finalResult = "";
    let stderr = "";
    const hardTimeout = setTimeout(() => child.kill("SIGKILL"), 280_000);

    function onLine(line: string) {
      line = line.trim();
      if (!line) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let evt: any;
      try {
        evt = JSON.parse(line);
      } catch {
        return;
      }
      if (evt.type === "system" && evt.subtype === "init") {
        log.line(`▸ claude started · model ${evt.model}`);
      } else if (evt.type === "assistant" && evt.message?.content) {
        for (const b of evt.message.content) {
          if (b.type === "text" && b.text) {
            log.line(b.text);
            tracker?.scanText(b.text);
          } else if (b.type === "tool_use")
            log.line(`  ⚙ ${b.name}(${JSON.stringify(b.input).slice(0, 140)})`);
        }
      } else if (evt.type === "user" && evt.message?.content) {
        for (const b of evt.message.content) {
          if (b.type === "tool_result") {
            const t =
              typeof b.content === "string"
                ? b.content
                : JSON.stringify(b.content);
            tracker?.scanJest(t);
            log.line(`    → ${String(t).slice(0, 240).replace(/\n/g, " ")}`);
          }
        }
      } else if (evt.type === "result") {
        if (evt.result) finalResult = evt.result;
        if (evt.is_error) log.line(`✖ ${evt.result}`);
      }
    }

    child.stdout.on("data", (d) => {
      buf += d.toString();
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const l = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        onLine(l);
      }
    });
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(hardTimeout);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(hardTimeout);
      if (buf.trim()) onLine(buf);
      if (code !== 0 && !finalResult) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`));
      } else {
        resolve(finalResult);
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Extract the agent's final JSON object via brace-matching (string-aware), so a
 * "comment" field containing markdown code fences (```) doesn't break parsing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  // Prefer the object right after a ```json fence; else the first '{'.
  let start = text.indexOf("{");
  const fence = text.search(/```json/i);
  if (fence >= 0) {
    const after = text.indexOf("{", fence);
    if (after >= 0) start = after;
  }
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          try {
            return parseJsonLoose(candidate);
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/** The comment to post: the structured field if present, else the raw report. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveComment(parsed: any, raw: string): string {
  return parsed?.comment ? String(parsed.comment) : raw.trim();
}

/** A structured result for the UI: parsed JSON, or a summary wrapping the raw text. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function structuredResult(parsed: any, raw: string): any {
  if (parsed) return parsed;
  const firstLine = (raw.split("\n").find((l) => l.trim()) || "").slice(0, 160);
  return { summary: firstLine, comment: raw.trim() };
}
