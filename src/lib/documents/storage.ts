import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DOCUMENTS_BUCKET } from "@/lib/env";
import type { Database } from "@/types/database.types";

type Supa = SupabaseClient<Database>;

/**
 * Permanently delete all Storage objects for a client (개인정보 파기). Storage
 * RLS restricts removal to the caller's own workspace prefix. Returns the number
 * of files removed. Deleting `documents` rows does NOT remove the underlying
 * files, so this must be called explicitly on client purge/delete.
 */
export async function purgeClientStorage(
  supabase: Supa,
  workspaceId: string,
  clientId: string,
): Promise<number> {
  const prefix = `${workspaceId}/${clientId}`;
  const { data: files } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .list(prefix, { limit: 1000 });
  if (!files || files.length === 0) return 0;

  const paths = files.filter((f) => f.name).map((f) => `${prefix}/${f.name}`);
  if (paths.length === 0) return 0;

  await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
  return paths.length;
}
