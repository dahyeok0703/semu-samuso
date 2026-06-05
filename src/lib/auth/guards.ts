import "server-only";

import { ActionException } from "@/lib/actions/safe-action";
import { getSession, type SessionContext } from "@/lib/auth/session";
import { getClientAssigneeIds } from "@/lib/clients/queries";

/**
 * Permission guards for server actions / route handlers. One place for the
 * role model: owner = full write, staff = write only on assigned clients, all
 * members read their workspace (RLS enforces the same — these give friendly
 * errors and short-circuit before hitting the DB).
 */

/** Authenticated actor, or throw UNAUTHORIZED. */
export async function requireActor(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new ActionException("UNAUTHORIZED", "로그인이 필요합니다.");
  return session;
}

/** Throw FORBIDDEN when the (already-loaded) session is not an owner. */
export function assertOwner(session: SessionContext): void {
  if (session.member.role !== "owner") {
    throw new ActionException("FORBIDDEN", "대표(owner)만 가능한 작업입니다.");
  }
}

/** Authenticated owner, or throw. */
export async function requireOwner(): Promise<SessionContext> {
  const session = await requireActor();
  assertOwner(session);
  return session;
}

/** Owner, or a staff member assigned to `clientId`. Returns the actor. */
export async function requireClientWrite(clientId: string): Promise<SessionContext> {
  const session = await requireActor();
  if (session.member.role === "owner") return session;
  const assignees = await getClientAssigneeIds(clientId);
  if (!assignees.includes(session.member.id)) {
    throw new ActionException("FORBIDDEN", "이 거래처에 대한 권한이 없습니다.");
  }
  return session;
}
