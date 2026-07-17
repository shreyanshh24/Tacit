import { cookies } from "next/headers";

export const SESSION_COOKIE = "tacit_session";

export interface Session {
  teamId: number | null;
  memberId: number | null;
  projectId: number | null;
}

const EMPTY: Session = { teamId: null, memberId: null, projectId: null };

/** Read the current demo session from the cookie (server-side). */
export async function getSession(): Promise<Session> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw);
    return {
      teamId: typeof p.teamId === "number" ? p.teamId : null,
      memberId: typeof p.memberId === "number" ? p.memberId : null,
      projectId: typeof p.projectId === "number" ? p.projectId : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Persist the session cookie (call from a Route Handler). */
export async function writeSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: false, // demo: readable by client for convenience
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
