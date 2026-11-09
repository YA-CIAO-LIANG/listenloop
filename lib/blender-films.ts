import type { Level } from "./categories";
import { parseSrt } from "./draft-video";
import type { Attribution } from "./videos";
import {
  excerptSeconds,
  transcriptSentences,
  type TimedSentence,
} from "./youtube";

/**
 * Official video materials from Blender's CC BY open movies (D118): each
 * film's official YouTube upload, its English subtitles (data/subtitles/,
 * from Wikimedia Commons, timed to that upload), and the 1–3 minute
 * excerpts made into shadowing materials. Titles and summaries are
 * written by hand; translations and notes are made by the language model
 * (npm run blender:drafts) and saved as official drafts for review.
 */

export type FilmExcerpt = {
  /** Stable key, e.g. "elephants-dream-1": the script skips one that exists. */
  key: string;
  /** Subtitles starting in [from, to) seconds of the film. */
  from: number;
  to: number;
  titleEn: string;
  titleZh: string;
  /** One line under the title (at most 30 characters, D71). */
  subtitle: string;
};

export type BlenderFilm = {
  id: string;
  youtubeId: string;
  /** Under data/subtitles/. */
  subtitles: string;
  subtitlesUrl: string;
  level: Level;
  credit: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  excerpts: FilmExcerpt[];
};

/** A material's excerpt length, in seconds (D118: 1 to 3 minutes). */
export const EXCERPT_SECONDS = { min: 60, max: 180 } as const;

export const BLENDER_FILMS: BlenderFilm[] = [
  {
    id: "elephants-dream",
    youtubeId: "TLkA0RELQ1g",
    subtitles: "elephants-dream.en.srt",
    subtitlesUrl:
      "https://commons.wikimedia.org/wiki/TimedText:Elephants_Dream.ogv.en.srt",
    level: "intermediate",
    credit: "© copyright Blender Foundation | orange.blender.org",
    license: "CC BY 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by/2.5/",
    sourceUrl: "https://orange.blender.org/",
    excerpts: [
      {
        key: "elephants-dream-1",
        from: 0,
        to: 196,
        titleEn: "Elephants Dream (1): Learn to Listen",
        titleZh: "Elephants Dream（1）：學會傾聽",
        subtitle: "Proog 帶 Emo 穿越危險的機器，要他學會傾聽",
      },
      {
        key: "elephants-dream-2",
        from: 260,
        to: 390,
        titleEn: "Elephants Dream (2): Close Your Eyes",
        titleZh: "Elephants Dream（2）：閉上眼睛",
        subtitle: "Emo 厭倦規矩，Proog 要他閉上眼睛看左右",
      },
      {
        key: "elephants-dream-3",
        from: 395,
        to: 545,
        titleEn: "Elephants Dream (3): It Is There",
        titleZh: "Elephants Dream（3）：它就在那裡",
        subtitle: "Emo 不再相信 Proog 的世界，兩人起了衝突",
      },
    ],
  },
  {
    id: "sprite-fright",
    youtubeId: "_cMxraX_5RE",
    subtitles: "sprite-fright.en.srt",
    subtitlesUrl:
      "https://commons.wikimedia.org/wiki/TimedText:Sprite_Fright_-_Blender_Open_Movie-full_movie.webm.en.srt",
    level: "advanced",
    credit: "(CC) Blender Foundation | studio.blender.org",
    license: "CC BY 1.0",
    licenseUrl: "https://creativecommons.org/licenses/by/1.0/",
    sourceUrl: "https://studio.blender.org/films/sprite-fright/pages/about/",
    // Left out: the opening (0:17–2:03), whose notes the model's content
    // filter refused (crude lines), and the second half, with little
    // dialogue and swearing not suited to a course for students.
    excerpts: [
      {
        key: "sprite-fright-2",
        from: 150,
        to: 252,
        titleEn: "Sprite Fright (2): Meeting the Sprites",
        titleZh: "Sprite Fright（2）：遇見小精靈",
        subtitle: "學生們發現蘑菇小精靈，精靈熱情招待他們",
      },
    ],
  },
];

const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * An excerpt's sentences from the film's subtitles: markup (<i>…</i>)
 * removed, then joined into sentences as for any YouTube practice (D97).
 */
export function excerptSentences(
  srt: string,
  excerpt: Pick<FilmExcerpt, "from" | "to">,
): TimedSentence[] {
  const cues = parseSrt(srt).map((cue) => ({
    ...cue,
    text: cue.text.replace(/<[^>]+>/g, ""),
  }));
  return transcriptSentences(cues, excerpt);
}

/** The credit an excerpt shows wherever it plays (D118). */
export function excerptAttribution(
  film: BlenderFilm,
  sentences: readonly TimedSentence[],
): Attribution {
  const from = sentences[0]?.start ?? 0;
  const to = sentences.at(-1)?.end ?? 0;
  return {
    credit: film.credit,
    license: film.license,
    licenseUrl: film.licenseUrl,
    sourceUrl: film.sourceUrl,
    transcriptUrl: film.subtitlesUrl,
    changes: `Excerpt (${mmss(from)}–${mmss(to)}) played through the official YouTube upload; English subtitles from Wikimedia Commons (CC BY-SA 4.0); sentence breaks, Chinese translation, vocabulary, and grammar notes added by ListenLoop`,
  };
}

/** Problems with an excerpt's plan, before anything is called. */
export function excerptProblems(sentences: readonly TimedSentence[]): string[] {
  const problems: string[] = [];
  const seconds = excerptSeconds(sentences);
  if (seconds < EXCERPT_SECONDS.min || seconds > EXCERPT_SECONDS.max) {
    problems.push(`length ${seconds}s`);
  }
  if (sentences.length < 3) problems.push(`${sentences.length} sentences`);
  return problems;
}
