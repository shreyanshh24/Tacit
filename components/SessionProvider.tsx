"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Team {
  id: number;
  name: string;
}
export interface Member {
  id: number;
  team_id: number;
  name: string;
  email: string | null;
  role: string | null;
}
export interface Project {
  id: number;
  team_id: number;
  name: string;
  owner_member_id: number | null;
  jira_project_key: string | null;
}

interface Hydrated {
  team: Team | null;
  member: Member | null;
  project: Project | null;
}

interface SessionContextValue extends Hydrated {
  loading: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  setSession: (patch: {
    teamId?: number | null;
    memberId?: number | null;
    projectId?: number | null;
  }) => Promise<Hydrated>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Hydrated>({ team: null, member: null, project: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session");
      const data = await res.json();
      setState({ team: data.team, member: data.member, project: data.project });
    } catch {
      setState({ team: null, member: null, project: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = useCallback(
    async (patch: { teamId?: number | null; memberId?: number | null; projectId?: number | null }) => {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      const hydrated: Hydrated = { team: data.team, member: data.member, project: data.project };
      setState(hydrated);
      return hydrated;
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    setState({ team: null, member: null, project: null });
  }, []);

  const isOwner =
    !!state.project && !!state.member && state.project.owner_member_id === state.member.id;

  return (
    <SessionContext.Provider
      value={{ ...state, loading, isOwner, refresh, setSession, logout }}
    >
      {children}
    </SessionContext.Provider>
  );
}
