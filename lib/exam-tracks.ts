import type { ExamId } from "./categories";
import type { WritingLevel, WritingType } from "./writing/types";

/**
 * "Exam English" (D215): the exams a learner prepares for, as one list
 * for the listening library, the writing prompts, and the exam guides.
 * Each track says which listening materials (an exam, sometimes one of
 * its targets) and which writing prompts (kinds, sometimes one level)
 * belong to it. GEPT is three tracks, one per level; the GSAT has no
 * listening section (its listening test is the senior high listening
 * test, a track of its own) and junior high's CAP has no writing section,
 * so their prompts are junior-high-level short writing.
 */
export type ExamTrack = {
  id: string;
  /** The guide page (/exams/<guide>) it belongs to. */
  guide: ExamGuideId;
  listening: { exam: ExamId; target?: string } | null;
  writing: { types: readonly WritingType[]; level?: WritingLevel } | null;
};

export const EXAM_GUIDES = [
  "toefl",
  "ielts",
  "toeic",
  "gept",
  "gsat",
  "hs-listening",
  "cap",
] as const;
export type ExamGuideId = (typeof EXAM_GUIDES)[number];

export const EXAM_TRACKS = [
  {
    id: "toefl",
    guide: "toefl",
    listening: { exam: "toefl" },
    writing: { types: ["toefl", "toefl-integrated"] },
  },
  {
    id: "ielts",
    guide: "ielts",
    listening: { exam: "ielts" },
    writing: { types: ["ielts-task1", "ielts-task2"] },
  },
  {
    id: "toeic",
    guide: "toeic",
    listening: { exam: "toeic" },
    writing: { types: ["toeic"] },
  },
  {
    id: "gept-elementary",
    guide: "gept",
    listening: { exam: "gept", target: "gept-elementary" },
    writing: { types: ["gept"], level: "beginner" },
  },
  {
    id: "gept-intermediate",
    guide: "gept",
    listening: { exam: "gept", target: "gept-intermediate" },
    writing: { types: ["gept"], level: "intermediate" },
  },
  {
    id: "gept-high-intermediate",
    guide: "gept",
    listening: { exam: "gept", target: "gept-high-intermediate" },
    writing: { types: ["gept"], level: "advanced" },
  },
  {
    id: "gsat",
    guide: "gsat",
    listening: null,
    writing: { types: ["gsat"] },
  },
  {
    id: "hs-listening",
    guide: "hs-listening",
    listening: { exam: "hs-listening" },
    writing: null,
  },
  {
    id: "cap",
    guide: "cap",
    listening: { exam: "cap" },
    writing: { types: ["cap"] },
  },
] as const satisfies readonly ExamTrack[];

export type ExamTrackId = (typeof EXAM_TRACKS)[number]["id"];

export const EXAM_TRACK_IDS: readonly ExamTrackId[] = EXAM_TRACKS.map(
  (track) => track.id,
);

export const findExamTrack = (id: string): ExamTrack | undefined =>
  (EXAM_TRACKS as readonly ExamTrack[]).find((track) => track.id === id);

export const isExamGuide = (value: unknown): value is ExamGuideId =>
  (EXAM_GUIDES as readonly unknown[]).includes(value);

/** Whether a listening material belongs to a track. */
export function inListeningTrack(
  item: { exam: string | null; examTarget: string | null },
  track: ExamTrack,
): boolean {
  const listening = track.listening;
  return (
    listening !== null &&
    item.exam === listening.exam &&
    (listening.target === undefined || item.examTarget === listening.target)
  );
}

/** Whether a writing prompt belongs to a track. */
export function inWritingTrack(
  prompt: { type: WritingType; level: WritingLevel },
  track: ExamTrack,
): boolean {
  const writing = track.writing;
  return (
    writing !== null &&
    writing.types.includes(prompt.type) &&
    (writing.level === undefined || prompt.level === writing.level)
  );
}

/** The tracks of a guide page, in order. */
export const guideTracks = (guide: ExamGuideId): ExamTrack[] =>
  (EXAM_TRACKS as readonly ExamTrack[]).filter(
    (track) => track.guide === guide,
  );
