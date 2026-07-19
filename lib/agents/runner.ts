// Autonomous agent runner. Spawns `claude -p` with tools inside a prepared repo
// working directory, streams the transcript into agent_runs.log, parses the final
// JSON result, and posts the outcome to Jira / the PR.

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

/** Run an agent end-to-end (synchronous). Returns the finished run id. */
export async function runAgent(
  agentId: number,
  trigger: "manual" | "schedule" = "manual"
): Promise<number> {
  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as
    | AgentRow
    | undefined;
  if (!agent) throw new Error("Agent not found");
  const config = agent.config ? JSON.parse(agent.config) : {};

  const runRes = db
    .prepare(
      "INSERT INTO agent_runs (agent_id, status, trigger, input, started_at) VALUES (?, 'running', ?, ?, datetime('now'))"
    )
    .run(agentId, trigger, JSON.stringify(config));
  const runId = Number(runRes.lastInsertRowid);

  try {
    const outcome = await execute(agent, config, runId);
    db.prepare(
      "UPDATE agent_runs SET status = 'done', finished_at = datetime('now'), result = ?, jira_ref = ?, pr_ref = ? WHERE id = ?"
    ).run(
      JSON.stringify(outcome.result),
      outcome.jira_ref,
      outcome.pr_ref,
      runId
    );
  } catch (e) {
    db.prepare(
      "UPDATE agent_runs SET status = 'failed', finished_at = datetime('now'), result = ? WHERE id = ?"
    ).run(JSON.stringify({ error: String((e as Error).message ?? e) }), runId);
  }
  return runId;
}

async function execute(
  agent: AgentRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  runId: number
): Promise<RunOutcome> {
  switch (agent.type) {
    case "scrum": {
      const t = config.transcriptName
        ? readTranscript(config.transcriptName)
        : latestTranscript();
      if (!t) throw new Error("No transcript found in TRANSCRIPTS_DIR.");
      const ticketKey = String(config.ticketKey || "").trim();
      if (!ticketKey) throw new Error("Scrum agent needs a ticketKey in its config.");
      const workdir = await prepareWorkdir(config.branch || "main");
      try {
        const prompt = scrumPrompt({
          transcript: t.text,
          ticketKey,
          transcriptName: t.name,
        });
        const { result } = await runClaudeAgent(prompt, workdir, runId);
        const parsed = extractJson(result);
        const comment = resolveComment(parsed, result);
        let jira_ref: string | null = null;
        if (comment) {
          await jiraComment(ticketKey, comment);
          jira_ref = ticketKey;
        }
        return { result: structuredResult(parsed, result), jira_ref, pr_ref: null };
      } finally {
        cleanupWorkdir(workdir);
      }
    }

    case "tester": {
      const ticketKey = String(config.ticketKey || "").trim();
      const branch = String(config.branch || "").trim();
      if (!ticketKey || !branch)
        throw new Error("Tester agent needs both branch and ticketKey.");
      const projectKey = ticketKey.slice(0, ticketKey.lastIndexOf("-")) || ticketKey;
      let ticketText = ticketKey;
      try {
        const issues = await fetchJiraIssues(projectKey);
        const found = issues.find((i) => i.source_id === ticketKey);
        if (found) ticketText = `${found.title}\n\n${found.content}`;
      } catch {
        /* fall back to just the key */
      }
      const workdir = await prepareWorkdir(branch);
      try {
        const prompt = testerPrompt({ ticketKey, ticketText, branch });
        const { result } = await runClaudeAgent(prompt, workdir, runId);
        const parsed = extractJson(result);
        const comment = resolveComment(parsed, result);
        let jira_ref: string | null = null;
        if (comment) {
          await jiraComment(ticketKey, comment);
          jira_ref = ticketKey;
        }
        return { result: structuredResult(parsed, result), jira_ref, pr_ref: null };
      } finally {
        cleanupWorkdir(workdir);
      }
    }

    case "pr_security": {
      const prNumber = Number(config.prNumber);
      if (!prNumber) throw new Error("PR-security agent needs a prNumber.");
      let branch = String(config.branch || "").trim();
      try {
        const prs = await listOpenPRs();
        const pr = prs.find((p) => p.number === prNumber);
        if (pr) branch = pr.headRefName;
      } catch {
        /* ignore */
      }
      const diff = await getPRDiff(prNumber);
      const workdir = await prepareWorkdir(branch || "main");
      try {
        const prompt = prSecurityPrompt({ prNumber, branch: branch || "main", diff });
        const { result } = await runClaudeAgent(prompt, workdir, runId);
        const parsed = extractJson(result);
        const comment = resolveComment(parsed, result);
        let pr_ref: string | null = null;
        if (comment) {
          await prComment(prNumber, comment);
          pr_ref = String(prNumber);
        }
        return { result: structuredResult(parsed, result), jira_ref: null, pr_ref };
      } finally {
        cleanupWorkdir(workdir);
      }
    }

    default:
      throw new Error(`Unknown agent type: ${agent.type}`);
  }
}

/** Spawn claude -p (agentic, tools on) in `cwd`; stream the log to agent_runs. */
function runClaudeAgent(
  prompt: string,
  cwd: string,
  runId: number
): Promise<{ result: string; log: string }> {
  return new Promise((resolve, reject) => {
    const db = getDb();
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
    let log = "";
    let finalResult = "";
    let stderr = "";

    const persist = () => {
      try {
        db.prepare("UPDATE agent_runs SET log = ? WHERE id = ?").run(log, runId);
      } catch {
        /* ignore */
      }
    };
    const timer = setInterval(persist, 1500);
    const hardTimeout = setTimeout(() => child.kill("SIGKILL"), 280_000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        log += `▸ started · model ${evt.model}\n`;
      } else if (evt.type === "assistant" && evt.message?.content) {
        for (const b of evt.message.content) {
          if (b.type === "text" && b.text) log += b.text + "\n";
          else if (b.type === "tool_use")
            log += `  ⚙ ${b.name}(${JSON.stringify(b.input).slice(0, 140)})\n`;
        }
      } else if (evt.type === "user" && evt.message?.content) {
        for (const b of evt.message.content) {
          if (b.type === "tool_result") {
            const t = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
            log += `    → ${String(t).slice(0, 240).replace(/\n/g, " ")}\n`;
          }
        }
      } else if (evt.type === "result") {
        if (evt.result) finalResult = evt.result;
        if (evt.is_error) log += `✖ ${evt.result}\n`;
      }
    }

    child.stdout.on("data", (d) => {
      buf += d.toString();
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        onLine(line);
      }
    });
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearInterval(timer);
      clearTimeout(hardTimeout);
      reject(e);
    });
    child.on("close", (code) => {
      clearInterval(timer);
      clearTimeout(hardTimeout);
      if (buf.trim()) onLine(buf);
      persist();
      if (code !== 0 && !finalResult) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`));
      } else {
        resolve({ result: finalResult, log });
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
