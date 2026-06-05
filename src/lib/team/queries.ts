import { createClient } from "@/lib/supabase/server";
import type { InvitationStatus, MemberRole, MemberStatus } from "@/types/database.types";

export type TeamMember = {
  id: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  userId: string | null;
  createdAt: string;
};

export async function listMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, role, status, user_id, created_at")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    status: m.status,
    userId: m.user_id,
    createdAt: m.created_at,
  }));
}

export type PendingInvite = {
  id: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export async function listPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
}

// --- bulk reassignment tool -------------------------------------------------
export type ClientAssignmentRow = {
  clientId: string;
  name: string;
  assigneeIds: string[];
};

export async function listClientsWithAssignees(): Promise<ClientAssignmentRow[]> {
  const supabase = await createClient();
  const [{ data: clients }, { data: assignments }] = await Promise.all([
    supabase.from("clients").select("id, biz_name").neq("status", "ended").order("biz_name"),
    supabase.from("client_assignments").select("client_id, member_id"),
  ]);

  const byClient = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = byClient.get(a.client_id) ?? [];
    list.push(a.member_id);
    byClient.set(a.client_id, list);
  }
  return (clients ?? []).map((c) => ({
    clientId: c.id,
    name: c.biz_name,
    assigneeIds: byClient.get(c.id) ?? [],
  }));
}
