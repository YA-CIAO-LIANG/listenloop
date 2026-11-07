import { getAdminSupabase } from "./admin";

export type AuditTarget = "user" | "practice" | "report" | "setting";

/**
 * Records an admin's change for the audit page (D56): who, when, on what,
 * and what changed. Values only, never keys or emails. Best effort, like
 * the activity log: a failure is logged on the server.
 */
export async function logAudit(
  adminId: string,
  action: string,
  target: { type: AuditTarget; id: string },
  changes: Record<string, unknown> = {},
): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return;
  const { error } = await admin.from("admin_audit").insert({
    admin_id: adminId,
    action,
    target_type: target.type,
    target_id: target.id,
    changes: JSON.parse(JSON.stringify(changes)),
  });
  if (error) console.error(`[audit] ${action} not logged: ${error.message}`);
}
