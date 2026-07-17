import { NextResponse } from "next/server";
import { getDb, ProjectRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchJiraIssueList } from "@/lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let projectKey = url.searchParams.get("projectKey")?.trim();

    // Load the active project for both its Jira key and its stored connection.
    let project: ProjectRow | undefined;
    const session = await getSession();
    if (session.projectId) {
      project = getDb()
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(session.projectId) as ProjectRow | undefined;
    }
    if (!projectKey) projectKey = project?.jira_project_key ?? undefined;

    if (!projectKey) {
      return NextResponse.json({
        issues: [],
        error: "No Jira project key. Connect Jira first or type a key.",
      });
    }

    const conn = project
      ? { baseUrl: project.jira_base_url, email: project.jira_email, token: project.jira_token }
      : undefined;
    const issues = await fetchJiraIssueList(projectKey, conn);
    return NextResponse.json({ issues, projectKey: projectKey.toUpperCase() });
  } catch (e) {
    return NextResponse.json(
      { issues: [], error: String((e as Error).message ?? e) },
      { status: 200 }
    );
  }
}
