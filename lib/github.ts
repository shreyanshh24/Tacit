// GitHub integration via the locally-authenticated `gh` CLI (no token in the app).
// Used to list PRs, read diffs, post PR comments, and prepare a local working
// clone that autonomous agents operate on.

import { spawn } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

export const DEFAULT_REPO = process.env.CRM360_REPO || "";

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; input?: string; timeoutMs?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: process.env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out`));
    }, opts.timeoutMs ?? 120_000);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args[0]} failed (${code}): ${err.slice(0, 300)}`));
    });
    if (opts.input != null) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

export interface PullRequest {
  number: number;
  title: string;
  headRefName: string;
  baseRefName?: string;
  url: string;
  author?: string;
}

/** List open PRs for a repo (defaults to CRM360_REPO). */
export async function listOpenPRs(repo = DEFAULT_REPO): Promise<PullRequest[]> {
  const out = await run("gh", [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--json",
    "number,title,headRefName,baseRefName,url,author",
  ]);
  const arr = JSON.parse(out || "[]");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return arr.map((p: any) => ({
    number: p.number,
    title: p.title,
    headRefName: p.headRefName,
    baseRefName: p.baseRefName,
    url: p.url,
    author: p.author?.login,
  }));
}

/** List branch names on the repo (via the gh API), newest activity first-ish. */
export async function listBranches(repo = DEFAULT_REPO): Promise<string[]> {
  try {
    const out = await run(
      "gh",
      ["api", "--paginate", `repos/${repo}/branches`, "-q", ".[].name"],
      { timeoutMs: 30_000 }
    );
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Get a PR's unified diff. */
export async function getPRDiff(prNumber: number, repo = DEFAULT_REPO): Promise<string> {
  return run("gh", ["pr", "diff", String(prNumber), "--repo", repo], {
    timeoutMs: 60_000,
  });
}

/** Post a comment to a PR (body via stdin to avoid shell escaping). */
export async function prComment(
  prNumber: number,
  body: string,
  repo = DEFAULT_REPO
): Promise<void> {
  await run(
    "gh",
    ["pr", "comment", String(prNumber), "--repo", repo, "--body-file", "-"],
    { input: body }
  );
}

/**
 * Clone `repo` at `branch` (shallow) into a fresh temp working directory the
 * agent can read and run tests in. Returns the absolute path.
 */
export async function prepareWorkdir(
  branch: string,
  repo = DEFAULT_REPO
): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tacit-agent-"));
  await run(
    "gh",
    ["repo", "clone", repo, dir, "--", "--branch", branch, "--depth", "1"],
    { timeoutMs: 180_000 }
  );
  return dir;
}

/** Best-effort cleanup of a prepared workdir. */
export function cleanupWorkdir(dir: string): void {
  try {
    if (dir && dir.startsWith(os.tmpdir())) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
