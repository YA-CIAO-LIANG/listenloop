import { parseTesterRows, type TesterRow } from "@/lib/beta-test";
import { getAdminSupabase } from "./admin";

/**
 * The Beta testers (D165): accounts that joined with an invite, all or
 * one invite's. Read with the secret key; admin pages only.
 */
export async function getBetaTesters(
  inviteId: string | null,
): Promise<TesterRow[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin.rpc(
    "beta_tester_activity",
    inviteId ? { invite: inviteId } : {},
  );
  return error ? [] : parseTesterRows(data);
}
