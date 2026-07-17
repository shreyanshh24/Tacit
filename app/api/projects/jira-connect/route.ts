import { NextResponse } from "next/server";
import { getDb, ProjectRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchJiraIssueList } from "@/lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function loadProject(projectId: number | null): ProjectRow | undefined {
  if (!projectId) return undefined;
  return getDb()
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(projectId) as ProjectRow | undefined;
}

/** Connection status for the active project (never returns the token). */
export async function GET() {
  const session = await getSession();
  const project = loadProject(session.projectId);
  const isOwner = !!project && project.owner_member_id === session.memberId;
  return NextResponse.json({
    connected: !!(project?.jira_base_url && project?.jira_email && project?.jira_token),
    isOwner,
    jira_base_url: project?.jira_base_url ?? null,
    jira_email: project?.jira_email ?? null,
    jira_project_key: project?.jira_project_key ?? null,
  });
}

/** Owner saves the project's Jira connection (base URL + email + token). */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    const project = loadProject(session.projectId);
    if (!project) {
      return NextResponse.json({ error: "No active project." }, { status: 400 });
    }
    if (project.owner_member_id !== session.memberId) {
      return NextResponse.json(
        { error: "Only the project owner can connect Jira." },
        { status: 403 }
      );
    }

    const { baseUrl, email, token, projectKey } = await req.json();
    if (!baseUrl || !email || !token) {
      return NextResponse.json(
        { error: "baseUrl, email and token are all required." },
        { status: 400 }
      );
    }

    const cleanBase = String(baseUrl).trim().replace(/\/$/, "");
    const conn = { baseUrl: cleanBase, email: String(email).trim(), token: String(token).trim() };

    // Validate the connection if a project key was provided.
    let validated: number | null = null;
    if (projectKey && String(projectKey).trim()) {
      const issues = await fetchJiraIssueList(String(projectKey).trim(), conn);
      validated = issues.length;
    }

    getDb()
      .prepare(
        "UPDATE projects SET jira_base_url = ?, jira_email = ?, jira_token = ?, jira_project_key = ? WHERE id = ?"
      )
      .run(
        conn.baseUrl,
        conn.email,
        conn.token,
        projectKey ? String(projectKey).trim().toUpperCase() : project.jira_project_key,
        project.id
      );

    return NextResponse.json({
      ok: true,
      connected: true,
      validatedIssueCount: validated,
      jira_project_key: projectKey ? String(projectKey).trim().toUpperCase() : project.jira_project_key,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
