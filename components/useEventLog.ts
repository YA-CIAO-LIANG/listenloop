"use client";

import { recordEvent } from "@/app/events/actions";
import type { ActivityEvent, ClientEventType } from "@/lib/events";

/**
 * Sends an activity event (D55) without waiting; a failure is ignored,
 * so practice never stops for the log. The server drops it when the
 * learner isn't signed in.
 */
export function logClientEvent(
  event: ActivityEvent & { type: ClientEventType },
): void {
  void recordEvent(event).catch(() => {});
}
