"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { creationAllowed } from "@/auth/creation-quota";
import { getCreator } from "@/auth/creator";
import { featurePaused } from "@/auth/site-switches";
import { logEvent } from "@/auth/events";
import { leaveQueue, takeTurn } from "@/auth/queue";
import { allowAction } from "@/auth/rate-limit";
import { getServerSupabase } from "@/auth/server";
import { meteredTranscribe } from "@/lib/ai/metered";
import { PRACTICE_LIMITS } from "@/lib/custom-practice/draft";
import { cleanSubtitle } from "@/lib/custom-practice/subtitle";
import { can, PLANS, planFor, type PlanBlock } from "@/lib/plans";
import { customPracticeId } from "@/lib/practice-material";
import { UPLOADS_BUCKET } from "@/lib/supabase/config";
import { keepTypedTitles } from "@/lib/titles";
import {
  UPLOAD_LIMITS,
  uploadLimits,
  type HeardSegment,
} from "@/lib/upload-audio";
import type { UsageBlock } from "@/lib/usage";
import { excerptSeconds, type TimedSentence } from "@/lib/youtube";

/**
 * Practices from the learner's own recording (D130), in three steps:
 * 1. startAudioUpload: a signed URL to upload the browser-made MP3 to
 *    the private bucket directly (not through our server functions);
 * 2. transcribeAudio: speech to text, a batch of short WAV pieces at a
 *    time, each piece metered;
 * 3. createUploadPractice: the sentences the learner checked, saved as a
 *    private practice that plays the recording. Notes come next, as for
 *    any practice; there's no speech to make.
 */

type Refusal = { reason: "plan"; limit: PlanBlock["limit"]; max?: number };

export type StartUploadResult =
  | { ok: true; path: string; token: string }
  | ({ ok: false } & (
      | Refusal
      | { reason: "unavailable" | "busy" | "too-big" | "too-long" | "failed" }
    ));

/** An upload in this user's folder, named as startAudioUpload names it. */
const isPath = (userId: string, value: unknown): value is string =>
  typeof value === "string" &&
  value.startsWith(`${userId}/`) &&
  /^[0-9a-f-]{36}\.mp3$/.test(value.slice(userId.length + 1));

/** What the plan says about uploading `bytes` and `seconds` of audio. */
async function uploadAllowed(
  creator: NonNullable<Awaited<ReturnType<typeof getCreator>>>,
  sourceBytes: number,
): Promise<Refusal | null> {
  const plan = planFor(creator.user);
  const upload = can(plan, { kind: "upload-audio", bytes: sourceBytes });
  if (!upload.ok) return { reason: "plan", ...upload };
  const quota = await creationAllowed(creator);
  if (!quota.ok) return { reason: "plan", ...quota };
  return null;
}

/** Uploading or transcribing paused by an emergency switch (D155). */
async function uploadPaused(user: { role?: string }): Promise<boolean> {
  return (
    (await featurePaused(user, "uploadAudio")) !== null ||
    (await featurePaused(user, "transcribe")) !== null
  );
}

/**
 * Step 1: checks the plan and the sizes the browser measured (the
 * picked file's, the MP3's, and its length), then makes a one-time
 * upload URL for a new file in the user's folder.
 */
export async function startAudioUpload(
  input: unknown,
): Promise<StartUploadResult> {
  const creator = await getCreator();
  const admin = getAdminSupabase();
  if (
    !creator ||
    !admin ||
    !creator.providers.transcribe ||
    (await uploadPaused(creator.user))
  ) {
    return { ok: false, reason: "unavailable" };
  }
  const raw = (input ?? {}) as Record<string, unknown>;
  const sourceBytes = Number(raw.sourceBytes);
  const bytes = Number(raw.bytes);
  const seconds = Number(raw.seconds);
  if (
    ![sourceBytes, bytes, seconds].every((n) => Number.isFinite(n) && n > 0)
  ) {
    return { ok: false, reason: "failed" };
  }
  const refused = await uploadAllowed(creator, sourceBytes);
  if (refused) return { ok: false, ...refused };
  const limits = uploadLimits(planFor(creator.user));
  if (sourceBytes > limits.bytes || bytes > UPLOAD_LIMITS.storedBytes) {
    return { ok: false, reason: "too-big" };
  }
  if (seconds > limits.seconds) return { ok: false, reason: "too-long" };
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const path = `${creator.user.id}/${crypto.randomUUID()}.mp3`;
  const { data, error } = await admin.storage
    .from(UPLOADS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, reason: "failed" };
  return { ok: true, path: data.path, token: data.token };
}

export type TranscribeResult =
  | { ok: true; heard: HeardSegment[] }
  /** Waiting in line (D133): `ahead` recordings go first. */
  | { ok: false; reason: "queued"; ahead: number }
  | ({ ok: false } & (
      | Refusal
      | { reason: "limit"; usage?: UsageBlock }
      | {
          reason: "unavailable" | "busy" | "config" | "failed" | "invalid";
        }
    ));

const WAV_BYTES_PER_SECOND = UPLOAD_LIMITS.sampleRate * 2;

/** A 16 kHz mono 16-bit WAV, and how long it is; null if it isn't one. */
function wavSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const text = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (
    text(0) !== "RIFF" ||
    text(8) !== "WAVE" ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== UPLOAD_LIMITS.sampleRate ||
    view.getUint16(34, true) !== 16
  ) {
    return null;
  }
  return (bytes.length - 44) / WAV_BYTES_PER_SECOND;
}

/**
 * Step 2: what's said in each piece of the uploaded recording. The form
 * has `path` (the upload, which must be the user's), `pieces` (JSON:
 * each piece's start and end in the recording), and `piece-<n>` WAV
 * files. Pieces go to the recognizer one at a time (the free tier allows
 * one request at a time); a busy answer is tried once more.
 */
export async function transcribeAudio(
  form: FormData,
): Promise<TranscribeResult> {
  const creator = await getCreator();
  if (
    !creator ||
    !creator.providers.transcribe ||
    (await featurePaused(creator.user, "transcribe"))
  ) {
    return { ok: false, reason: "unavailable" };
  }
  const refused = await uploadAllowed(creator, 0);
  if (refused) return { ok: false, ...refused };
  if (!isPath(creator.user.id, form.get("path"))) {
    return { ok: false, reason: "invalid" };
  }
  let pieces: unknown;
  try {
    pieces = JSON.parse(String(form.get("pieces")));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (
    !Array.isArray(pieces) ||
    pieces.length === 0 ||
    pieces.length > UPLOAD_LIMITS.batchPieces
  ) {
    return { ok: false, reason: "invalid" };
  }
  const plan = planFor(creator.user);
  const path = String(form.get("path"));
  // One recording at a time through the free speech to text (D133).
  const turn = await takeTurn("transcribe", path, creator.user, plan);
  if (!turn.turn) return { ok: false, reason: "queued", ahead: turn.ahead };
  const minutes = PLANS[plan].minutesPerMonth;
  const userMaxSeconds = minutes === null ? null : minutes * 60;
  const heard: HeardSegment[] = [];
  for (const [i, piece] of pieces.entries()) {
    const { start, end } = (piece ?? {}) as Record<string, unknown>;
    const file = form.get(`piece-${i}`);
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !(start >= 0 && end > start) ||
      end > UPLOAD_LIMITS.seconds ||
      !(file instanceof Blob) ||
      file.size > (UPLOAD_LIMITS.segmentSeconds + 1) * WAV_BYTES_PER_SECOND
    ) {
      return { ok: false, reason: "invalid" };
    }
    const wav = new Uint8Array(await file.arrayBuffer());
    const seconds = wavSeconds(wav);
    if (seconds === null || Math.abs(seconds - (end - start)) > 0.5) {
      return { ok: false, reason: "invalid" };
    }
    let result = await meteredTranscribe(creator, wav, seconds, userMaxSeconds);
    if (!result.ok && result.reason === "busy") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      result = await meteredTranscribe(creator, wav, seconds, userMaxSeconds);
    }
    if (!result.ok) {
      if (result.reason !== "busy") await leaveQueue("transcribe", path);
      return result.reason === "limit"
        ? { ok: false, reason: "limit", usage: result.limit }
        : { ok: false, reason: result.reason };
    }
    const value = result.value;
    // The speech inside the piece, when the recognizer says where it is.
    const from = value.duration > 0 ? start + value.offset : start;
    const to =
      value.duration > 0 ? Math.min(end, from + value.duration + 0.15) : end;
    heard.push({
      start: Math.round(Math.max(start, from - 0.15) * 100) / 100,
      end: Math.round(to * 100) / 100,
      text: value.text,
    });
  }
  // The page says which batch is its last: the next recording goes.
  if (form.get("last") === "1") await leaveQueue("transcribe", path);
  return { ok: true, heard };
}

export type CreateUploadResult =
  | { ok: true; id: string }
  | ({ ok: false } & (
      | Refusal
      | {
          reason: "unavailable" | "busy" | "invalid" | "too-long" | "failed";
          max?: number;
        }
    ));

/** The checked sentences: in order, inside the recording, not too long. */
function cleanSentences(
  input: unknown,
  seconds: number,
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
      end <= start ||
      end > seconds + 1 ||
      (previous && start < previous.start)
    ) {
      return null;
    }
    sentences.push({
      en,
      zh,
      start: Math.round(start * 100) / 100,
      end: Math.round(end * 100) / 100,
    });
  }
  return sentences;
}

/**
 * Step 3: saves the practice, always private to start with (sharing it
 * needs the author to confirm the rights, D130). The file must be in
 * the user's folder already.
 */
export async function createUploadPractice(
  input: unknown,
): Promise<CreateUploadResult> {
  const creator = await getCreator();
  const admin = getAdminSupabase();
  if (
    !creator ||
    !admin ||
    !creator.providers.transcribe ||
    (await uploadPaused(creator.user))
  ) {
    return { ok: false, reason: "unavailable" };
  }
  const refused = await uploadAllowed(creator, 0);
  if (refused) return { ok: false, ...refused };
  if (!(await allowAction("ai", creator.user.id))) {
    return { ok: false, reason: "busy" };
  }
  const raw = (input ?? {}) as Record<string, unknown>;
  const seconds = Number(raw.seconds);
  if (
    !isPath(creator.user.id, raw.path) ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > UPLOAD_LIMITS.seconds
  ) {
    return { ok: false, reason: "invalid" };
  }
  const plan = planFor(creator.user);
  if (seconds > uploadLimits(plan).seconds) {
    return { ok: false, reason: "too-long", max: uploadLimits(plan).seconds };
  }
  const sentences = cleanSentences(raw.sentences, seconds);
  if (!sentences) return { ok: false, reason: "invalid" };
  const length = excerptSeconds(sentences);
  const long = can(plan, { kind: "practice-seconds", seconds: length });
  if (!long.ok) return { ok: false, reason: "too-long", max: long.max };

  // The upload must really be there (the browser said it finished).
  const [folder, name] = raw.path.split("/");
  const { data: files } = await admin.storage
    .from(UPLOADS_BUCKET)
    .list(folder, { search: name, limit: 1 });
  if (!files?.some((file) => file.name === name)) {
    return { ok: false, reason: "invalid" };
  }

  const titles = keepTypedTitles(
    { en: raw.titleEn, zh: raw.titleZh },
    { en: sentences[0].en.slice(0, PRACTICE_LIMITS.titleChars), zh: "" },
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
      source_audio_path: raw.path,
      source_audio_seconds: Math.round(seconds * 100) / 100,
      visibility: "private",
      estimated_seconds: length,
      duration_sec: length,
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
