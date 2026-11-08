import { after } from "next/server";
import { getSignedInUser } from "@/auth/session";
import {
  generatePracticeAudio,
  generatePracticeNotes,
} from "@/app/materials/actions";
import { prepareForPractice } from "@/components/practice-generation";

/** One run's share of the function's time (Vercel Hobby: 60 s). */
export const maxDuration = 60;
const RUN_SECONDS = 50;
/** Runs in a row before stopping (about 5 minutes in all). */
const MAX_HOPS = 6;

/**
 * Keeps getting a practice ready after its page was closed (D95): the
 * create page sends a beacon here when it goes away mid-way. The work is
 * the same batches the browser runs (each skips what's done), after the
 * response; a run that needs longer hands over to a fresh one. My
 * materials shows the practice ready, or "continue" if it stopped.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const origin = new URL(request.url).origin;
  // Same-site only (a beacon from our own page).
  const from = request.headers.get("origin");
  if (from && from !== origin) return new Response(null, { status: 403 });
  const user = await getSignedInUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) {
    return new Response(null, { status: 404 });
  }
  const hop = Number(request.headers.get("x-ll-hop") ?? "0") || 0;
  const cookie = request.headers.get("cookie") ?? "";

  after(async () => {
    const deadline = Date.now() + RUN_SECONDS * 1000;
    const inTime = <T>(call: () => Promise<T>, late: T) =>
      Date.now() < deadline ? call() : Promise.resolve(late);
    const result = await prepareForPractice(
      {
        generateNotes: (practiceId) =>
          inTime(() => generatePracticeNotes(practiceId), {
            ok: false,
            reason: "unavailable",
          } as const),
        generate: (practiceId) =>
          inTime(() => generatePracticeAudio(practiceId), {
            ok: false,
            reason: "unavailable",
          } as const),
      },
      // Notes first if needed; each step skips what's already done.
      { id, notesReady: false, total: 0 },
      () => {},
    );
    const outOfTime =
      !result.ok && result.reason === "unavailable" && Date.now() >= deadline;
    if (outOfTime && hop + 1 < MAX_HOPS) {
      await fetch(`${origin}/materials/${id}/prepare`, {
        method: "POST",
        headers: { cookie, origin, "x-ll-hop": String(hop + 1) },
      }).catch(() => {});
    }
  });
  return new Response(null, { status: 202 });
}
