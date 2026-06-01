import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Member, Workspace } from "@/types/database.types";

export type SessionContext = {
  userId: string;
  email: string | null;
  member: Member;
  workspace: Workspace;
};

/**
 * Loads the authenticated user along with their primary workspace + member
 * record. Returns null when unauthenticated. Cached per-request so multiple
 * server components can call it without extra round-trips.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // A user belongs to at least one workspace (created at signup). We pick the
  // earliest membership as the active workspace for now; workspace switching
  // can be layered on later.
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", member.workspace_id)
    .maybeSingle();

  if (!workspace) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    member,
    workspace,
  };
});

/**
 * Guard for (app) server components. Redirects to /login when there is no
 * usable session.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
