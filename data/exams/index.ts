import { examGuideProblems, type ExamGuide } from "@/lib/exam-guides";
import type { ExamGuideId } from "@/lib/exam-tracks";
import cap from "./cap.json";
import gept from "./gept.json";
import gsat from "./gsat.json";
import hsListening from "./hs-listening.json";
import ielts from "./ielts.json";
import toefl from "./toefl.json";
import toeic from "./toeic.json";

/**
 * The exam guides (D215), in the order they're listed. Imported
 * statically so they ship with the build, and checked at import: a
 * guide with problems fails the build.
 */
const all = [
  toefl,
  ielts,
  toeic,
  gept,
  gsat,
  hsListening,
  cap,
] as unknown as ExamGuide[];

for (const guide of all) {
  const problems = examGuideProblems(guide);
  if (problems.length) {
    throw new Error(`data/exams/${guide.id}.json: ${problems.join(", ")}`);
  }
}

export const examGuides: readonly ExamGuide[] = all;

export const getExamGuide = (id: ExamGuideId): ExamGuide | undefined =>
  all.find((guide) => guide.id === id);
