import type { Supabase } from "./supabase/browser";
import type { QuizSummary, WordResult } from "./vocab-quiz";

/**
 * Finished vocabulary quizzes (D136), in vocab_quiz_attempts: added from
 * the browser with the learner's own session (row level security keeps
 * everyone to their own rows). Signed out, nothing is kept.
 */
export type QuizAttempt = {
  videoId: string;
  day: 1 | 7;
  takenAt: string;
  total: number;
  spelled: number;
  translated: number;
  hints: number;
  words: WordResult[];
};

/** Saves a quiz; "signed-out" when there's no session to save it with. */
export async function saveQuizAttempt(
  supabase: Supabase | null,
  attempt: {
    videoId: string;
    day: 1 | 7;
    summary: QuizSummary;
    words: WordResult[];
  },
): Promise<"saved" | "signed-out" | "failed"> {
  if (!supabase) return "signed-out";
  const { data } = await supabase.auth.getSession();
  if (!data.session) return "signed-out";
  const { error } = await supabase.from("vocab_quiz_attempts").insert({
    video_id: attempt.videoId,
    day: attempt.day,
    total: attempt.summary.total,
    spelling_correct: attempt.summary.spelled,
    translation_correct: attempt.summary.translated,
    hints_used: attempt.summary.hints,
    words: attempt.words,
  });
  return error ? "failed" : "saved";
}

const isWordResult = (value: unknown): value is WordResult => {
  const w = (value ?? {}) as Record<string, unknown>;
  return (
    typeof w.word === "string" &&
    typeof w.spelled === "boolean" &&
    typeof w.translated === "boolean" &&
    typeof w.hints === "number"
  );
};

/** The learner's quizzes, oldest first (the newest 500). */
export async function loadQuizAttempts(
  supabase: Supabase | null,
): Promise<QuizAttempt[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("vocab_quiz_attempts")
    .select(
      "video_id, day, taken_at, total, spelling_correct, translation_correct, hints_used, words",
    )
    .order("taken_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data
    .map((row) => ({
      videoId: row.video_id,
      day: row.day === 7 ? (7 as const) : (1 as const),
      takenAt: row.taken_at,
      total: row.total,
      spelled: row.spelling_correct,
      translated: row.translation_correct,
      hints: row.hints_used,
      words: Array.isArray(row.words) ? row.words.filter(isWordResult) : [],
    }))
    .reverse();
}
