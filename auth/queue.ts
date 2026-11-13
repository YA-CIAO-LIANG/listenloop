import type { PlanId } from "@/lib/plans";
import {
  QUEUE,
  QUEUE_PRIORITY,
  queueTicket,
  type QueueResource,
} from "@/lib/queue";
import { getAdminSupabase } from "./admin";

/**
 * Takes a place in line (D133) and says whether it's this job's turn,
 * or how many jobs are ahead. Fails open: without the secret key or when
 * the database can't be reached, the job just runs (as before).
 */
export async function takeTurn(
  resource: QueueResource,
  id: string,
  user: { id: string },
  plan: PlanId,
): Promise<{ turn: true } | { turn: false; ahead: number }> {
  const admin = getAdminSupabase();
  if (!admin) return { turn: true };
  let answer: { data: unknown; error: unknown };
  try {
    answer = await admin.rpc("queue_position", {
      target_resource: resource,
      target_ticket: queueTicket(resource, id),
      target_user: user.id,
      // Fair priority by plan (D162).
      target_priority: QUEUE_PRIORITY[plan],
      stale_seconds: QUEUE.staleSeconds,
    });
  } catch (error) {
    answer = { data: null, error };
  }
  const { data, error } = answer;
  if (error || typeof data !== "number") return { turn: true };
  const ahead = data - QUEUE.slots[resource] + 1;
  return ahead > 0 ? { turn: false, ahead } : { turn: true };
}

/** Leaves the line: the job is done, or stopped. */
export async function leaveQueue(resource: QueueResource, id: string) {
  try {
    await getAdminSupabase()?.rpc("queue_leave", {
      target_ticket: queueTicket(resource, id),
    });
  } catch {
    // The ticket drops out on its own once stale.
  }
}
