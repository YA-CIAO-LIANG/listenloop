"use server";

import { revalidatePath } from "next/cache";
import { creationAllowed } from "@/auth/creation-quota";
import { getCreator } from "@/auth/creator";
import { logEvent } from "@/auth/events";
import { allowAction } from "@/auth/rate-limit";
import { getServerSupabase } from "@/auth/server";
import { getYouTubeLookup } from "@/auth/youtube";
import { PRACTICE_LIMITS } from "@/lib/custom-practice/draft";
import { cleanSubtitle } from "@/lib/custom-practice/subtitle";
import { can, planFor } from "@/lib/plans";
import { customPracticeId } from "@/lib/practice-material";
import { keepTypedTitles } from "@/lib/titles";
import {
  excerptSeconds,
  parseYouTubeUrl,
  type TimedSentence,
  type YouTubeVideoInfo,
} from "@/lib/youtube";

export type LookupYouTubeResult =
  | { ok: true; video: YouTubeVideoInfo }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "plan"
        | "busy"
        | "invalid"
        | "not-found"
        | "not-embeddable"
        | "failed";
    };

/**
 * Reads a pasted link's video (D97): title, channel, license, length, and
 * whether it may play on other sites. Paid plans only (lib/plans.ts).
 */
export async function lookupYouTube(
  url: unknown,
): Promise<LookupYouTubeResult> {
  const creator = await getCreator();
  const lookup = getYouTubeLookup();
  if (!creator || !lookup) return { ok: false, reason: "unavailable" };
  if (!can(planFor(creator.user), { kind: "youtube-practice" }).ok) {
    return { ok: false, reason: "plan" };
  }
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const id = typeof url === "string" ? parseYouTubeUrl(url) : null;
  if (!id) return { ok: false, reason: "invalid" };
  const video = await lookup(id).catch(() => undefined);
  if (video === undefined) return { ok: false, reason: "failed" };
  if (!video) return { ok: false, reason: "not-found" };
  if (!video.embeddable) return { ok: false, reason: "not-embeddable" };
  return { ok: true, video };
}

export type CreateYouTubePracticeResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "plan"
        | "busy"
        | "invalid"
        | "not-found"
        | "too-long"
        | "failed";
      max?: number;
    };

/** Checks the sentences from the browser: in order, inside the video. */
function cleanSentences(
  input: unknown,
  durationSeconds: number,
): (TimedSentence & { zh: string })[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (input.length > PRACTICE_LIMITS.sentences) return null;
  const sentences: (TimedSentence & { zh: string })[] = [];
  for (const raw of input) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const en = typeof s.en === "string" ? s.en.replace(/\s+/g, " ").trim() : "";
    const zh = typeof s.zh === "string" ? s.zh.replace(/\s+/g, " ").trim() : "";
    const start = Number(s.start);
    const end = Number(s.end);
    const previous = sentences.at(-1);
    if (
      !en ||
      [...en].length > PRACTICE_LIMITS.sentenceChars ||
      [...zh].length > PRACTICE_LIMITS.sentenceChars ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      end > durationSeconds + 5 ||
      (previous && start < previous.start)
    ) {
      return null;
    }
    sentences.push({ en, zh, start, end });
  }
  return sentences;
}

/**
 * Saves a YouTube practice (D97): the video, its sentences with their
 * times, and their translations; always private to start with (only a
 * Creative Commons video can be made public later). The notes are made
 * next, as for any practice; there's no audio to make.
 */
export async function createYouTubePractice(
  input: unknown,
): Promise<CreateYouTubePracticeResult> {
  const creator = await getCreator();
  const lookup = getYouTubeLookup();
  if (!creator || !lookup) return { ok: false, reason: "unavailable" };
  const plan = planFor(creator.user);
  if (
    !can(plan, { kind: "youtube-practice" }).ok ||
    !(await creationAllowed(creator)).ok
  ) {
    return { ok: false, reason: "plan" };
  }
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = typeof raw.url === "string" ? parseYouTubeUrl(raw.url) : null;
  if (!id) return { ok: false, reason: "invalid" };
  // The license and channel come from YouTube, never from the browser.
  const video = await lookup(id).catch(() => null);
  if (!video || !video.embeddable) return { ok: false, reason: "not-found" };
  const sentences = cleanSentences(raw.sentences, video.durationSeconds);
  if (!sentences) return { ok: false, reason: "invalid" };
  const long = can(plan, {
    kind: "practice-seconds",
    seconds: excerptSeconds(sentences),
  });
  if (!long.ok) return { ok: false, reason: "too-long", max: long.max };

  const titles = keepTypedTitles(
    { en: raw.titleEn, zh: raw.titleZh },
    { en: video.title.slice(0, PRACTICE_LIMITS.titleChars), zh: "" },
  );
  if (
    [...titles.en].length > PRACTICE_LIMITS.titleChars ||
    [...titles.zh].length > PRACTICE_LIMITS.titleChars
  ) {
    return { ok: false, reason: "invalid" };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "unavailable" };
  const { data, error } = await supabase
    .from("practices")
    .insert({
      user_id: creator.user.id,
      title: titles.en || titles.zh,
      title_en: titles.en || null,
      title_zh: titles.zh || null,
      subtitle: cleanSubtitle(raw.subtitle),
      source_language: "en",
      youtube_id: video.id,
      youtube_channel: video.channel,
      youtube_license: video.license,
      visibility: "private",
      estimated_seconds: excerptSeconds(sentences),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: "failed" };
  const { error: sentencesError } = await supabase
    .from("practice_sentences")
    .insert(
      sentences.map((s, i) => ({
        practice_id: data.id,
        i,
        en: s.en,
        zh: s.zh,
        start_sec: s.start,
        end_sec: s.end,
      })),
    );
  if (sentencesError) {
    await supabase.from("practices").delete().eq("id", data.id);
    return { ok: false, reason: "failed" };
  }
  await logEvent(creator.user.id, {
    type: "practice_create",
    videoId: customPracticeId(data.id),
  });
  revalidatePath("/materials");
  return { ok: true, id: data.id };
}
