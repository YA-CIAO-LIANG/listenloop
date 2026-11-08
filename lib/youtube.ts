import type { SrtCue } from "./draft-video";
import type { Attribution } from "./videos";

/**
 * Practices from a YouTube video (D97): what's read from the YouTube Data
 * API, the link and transcript the learner pastes, and how the transcript
 * becomes practice sentences. The video plays through the embedded player;
 * its sound and captions are never downloaded.
 */
export type YouTubeLicense = "youtube" | "creativeCommon";

export type YouTubeVideoInfo = {
  id: string;
  title: string;
  channel: string;
  license: YouTubeLicense;
  durationSeconds: number;
  /** The uploader allows playing it on other sites. */
  embeddable: boolean;
};

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id in a YouTube link (watch, youtu.be, shorts, embed), or null. */
export function parseYouTubeUrl(input: string): string | null {
  const text = input.trim();
  if (ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ??
      null;
  }
  return id && ID.test(id) ? id : null;
}

/** "PT1H2M3S" → 3723 seconds; null if it isn't one. */
export function parseIsoDuration(value: string): number | null {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match || value === "P" || value === "PT") return null;
  const [, d = "0", h = "0", m = "0", s = "0"] = match;
  return Number(d) * 86400 + Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** A sentence of a YouTube practice: its words and where it plays. */
export type TimedSentence = { en: string; start: number; end: number };

/** A sentence gets no longer than this many words when captions run on. */
export const MAX_SENTENCE_WORDS = 30;
/** A pause this long (seconds) between captions ends a sentence. */
export const SENTENCE_PAUSE = 2;

const round = (seconds: number) => Math.round(seconds * 100) / 100;

/**
 * Captions to practice sentences: consecutive captions join until one
 * ends a sentence (. ? !), the speaker pauses SENTENCE_PAUSE, or it would
 * pass MAX_SENTENCE_WORDS (automatic captions have no punctuation). Each
 * sentence plays from its first caption's start to its last's end, so a
 * sentence never starts or stops in the middle of a caption.
 */
export function transcriptSentences(
  cues: readonly SrtCue[],
  range: { from?: number; to?: number } = {},
): TimedSentence[] {
  const from = range.from ?? 0;
  const to = range.to ?? Number.POSITIVE_INFINITY;
  const inside = cues.filter((cue) => cue.start >= from && cue.start < to);
  const sentences: TimedSentence[] = [];
  let current: TimedSentence | null = null;
  const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
  for (const cue of inside) {
    const text = cue.text
      .replace(/\[[^\]]*\]|\([^)]*\)/g, " ") // [Music], (applause)
      .replace(/\s+/g, " ")
      .trim();
    if (!/[A-Za-z]/.test(text)) continue;
    const joins =
      current &&
      cue.start - current.end <= SENTENCE_PAUSE &&
      !/[.?!]["”’)]?$/.test(current.en) &&
      words(current.en) + words(text) <= MAX_SENTENCE_WORDS;
    if (current && joins) {
      current.en = `${current.en} ${text}`;
      current.end = round(Math.min(cue.end, to));
    } else {
      current = {
        en: text,
        start: round(cue.start),
        end: round(Math.min(cue.end, to)),
      };
      sentences.push(current);
    }
  }
  return sentences;
}

/** Seconds of the video the sentences cover. */
export function excerptSeconds(sentences: readonly TimedSentence[]): number {
  if (sentences.length === 0) return 0;
  return Math.round(sentences.at(-1)!.end - sentences[0].start);
}

export const youtubeWatchUrl = (id: string) =>
  `https://www.youtube.com/watch?v=${id}`;

/**
 * The credit a YouTube practice shows wherever it plays (D97): the
 * channel, the license, and the video's page. YouTube's Creative Commons
 * option is CC BY 3.0.
 */
export function youtubeAttribution(video: {
  id: string;
  channel: string;
  license: YouTubeLicense;
}): Attribution {
  const cc = video.license === "creativeCommon";
  return {
    credit: `© ${video.channel} (YouTube)`,
    license: cc ? "CC BY 3.0" : "YouTube Standard License",
    licenseUrl: cc
      ? "https://creativecommons.org/licenses/by/3.0/"
      : "https://www.youtube.com/static?template=terms",
    sourceUrl: youtubeWatchUrl(video.id),
    transcriptUrl: youtubeWatchUrl(video.id),
    changes:
      "Excerpt played through YouTube's player; sentence breaks, Chinese translation, vocabulary, and grammar notes added by a ListenLoop learner",
  };
}
