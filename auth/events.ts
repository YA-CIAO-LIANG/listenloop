import type { ActivityEvent } from "@/lib/events";
import { getAdminSupabase } from "./admin";

/**
 * Records one activity event (D55) with the secret key, and notes the
 * user's last activity on their profile. Best effort: logging never fails
 * or slows down what the user did beyond one insert.
 */
export async function logEvent(
  userId: string | null,
  event: ActivityEvent,
): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return;
  try {
    const { error } = await admin.from("events").insert({
      user_id: userId,
      type: event.type,
      video_id: event.videoId ?? null,
      day: event.day ?? null,
      score: event.score ?? null,
      code: event.code ?? null,
    });
    if (error) throw new Error(error.message);
    if (userId) {
      await admin
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
  } catch (error) {
    console.error(
      `[events] ${event.type} not logged: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
