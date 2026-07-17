// Live Jira Cloud connector. Uses Basic auth (email + API token) against the
// Jira REST API v3 and maps issues into Tacit's document shape.
//
// A connection can be passed per-project; if omitted, it falls back to the
// JIRA_* environment variables (useful for local/dev).

export interface JiraConnection {
  baseUrl: string;
  email: string;
  token: string;
}

export interface JiraDocument {
  source: "jira";
  source_id: string;
  author: string;
  ts: string;
  title: string;
  content: string;
}

export interface JiraIssueOption {
  key: string;
  summary: string;
  url: string;
}

function resolveConn(conn?: Partial<JiraConnection> | null): JiraConnection {
  return {
    baseUrl: (conn?.baseUrl || process.env.JIRA_BASE_URL || "").replace(/\/$/, ""),
    email: conn?.email || process.env.JIRA_EMAIL || "",
    token: conn?.token || process.env.JIRA_API_TOKEN || "",
  };
}

function assertConn(c: JiraConnection) {
  const missing = [
    !c.baseUrl && "base URL",
    !c.email && "email",
    !c.token && "API token",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Jira is not connected (missing ${missing.join(", ")}). The project owner can connect Jira, or set JIRA_* in .env.local.`
    );
  }
}

function authHeader(c: JiraConnection): string {
  return `Basic ${Buffer.from(`${c.email}:${c.token}`).toString("base64")}`;
}

/** Build a browse URL for an issue key. */
export function jiraIssueUrl(key: string, baseUrl?: string | null): string {
  const b = (baseUrl || process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
  return b && key ? `${b}/browse/${key}` : "";
}

/** Recursively flatten an Atlassian Document Format (ADF) node into plain text. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adfToText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";

  const inner = node.content ? adfToText(node.content) : "";
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
      return inner + "\n";
    case "listItem":
      return `- ${inner.trim()}\n`;
    default:
      return inner;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIssue(issue: any, baseUrl: string): JiraDocument {
  const f = issue.fields ?? {};
  const description =
    typeof f.description === "string" ? f.description : adfToText(f.description);

  const comments: string = (f.comment?.comments ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => {
      const who = c.author?.displayName ?? "Unknown";
      const body = typeof c.body === "string" ? c.body : adfToText(c.body);
      return `${who}: ${body.trim()}`;
    })
    .join("\n");

  const content = [description.trim(), comments.trim()].filter(Boolean).join("\n\n");

  // Prefix the browse URL so it can be surfaced later if needed.
  void baseUrl;

  return {
    source: "jira",
    source_id: issue.key,
    author: f.reporter?.displayName ?? "Unknown",
    ts: f.created ?? new Date().toISOString(),
    title: f.summary ?? issue.key,
    content: content || f.summary || "",
  };
}

async function jiraGet(
  c: JiraConnection,
  jql: string,
  fields: string,
  maxResults: number
) {
  const headers = { Authorization: authHeader(c), Accept: "application/json" };
  const qs = `jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
  const enhanced = `${c.baseUrl}/rest/api/3/search/jql?${qs}`;
  const legacy = `${c.baseUrl}/rest/api/3/search?${qs}`;

  let res = await fetch(enhanced, { headers });
  if (res.status === 404 || res.status === 410) res = await fetch(legacy, { headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Jira auth failed (${res.status}). Check the connected email and API token.`
      );
    }
    throw new Error(`Jira API error ${res.status}: ${body.slice(0, 250)}`);
  }
  return res.json();
}

/** Lightweight list of issues (key + summary) for a ticket picker. */
export async function fetchJiraIssueList(
  projectKey: string,
  conn?: Partial<JiraConnection> | null
): Promise<JiraIssueOption[]> {
  const c = resolveConn(conn);
  assertConn(c);
  const key = projectKey.trim().toUpperCase();
  const jql = `project = "${key}" ORDER BY created ASC`;
  const data = await jiraGet(c, jql, "summary", 100);
  const issues = Array.isArray(data.issues) ? data.issues : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return issues.map((i: any) => ({
    key: i.key,
    summary: i.fields?.summary ?? i.key,
    url: jiraIssueUrl(i.key, c.baseUrl),
  }));
}

/** Fetch up to 50 issues for a project and map them to documents. */
export async function fetchJiraIssues(
  projectKey: string,
  conn?: Partial<JiraConnection> | null
): Promise<JiraDocument[]> {
  const c = resolveConn(conn);
  assertConn(c);
  const key = projectKey.trim().toUpperCase();
  const jql = `project = "${key}" ORDER BY created ASC`;
  const data = await jiraGet(c, jql, "summary,description,created,reporter,comment", 50);
  const issues = Array.isArray(data.issues) ? data.issues : [];
  return issues.map((i: unknown) => mapIssue(i, c.baseUrl));
}
