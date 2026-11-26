import { EXAM_GUIDES, type ExamGuideId } from "./exam-tracks";

/**
 * An exam's guide (D215): what the test is, its parts, how listening
 * and writing are scored, how to practise, and links to the exam owner's
 * free official practice (links only, each checked on `checkedAt`).
 * The text is in data/exams/<id>.json in both languages, like the
 * writing prompts; tests/exam-guides.test.ts checks every file.
 */
export type Bilingual = { zh: string; en: string };

export type ExamGuideSection = {
  id: "about" | "format" | "listening-scoring" | "writing-scoring" | "practice";
  heading: Bilingual;
  paragraphs: { zh: string[]; en: string[] };
};

export type ExamResource = {
  title: Bilingual;
  publisher: string;
  url: string;
  kind: "practice" | "sample" | "past-papers" | "format";
  /** YYYY-MM-DD, the day the link was opened and found working. */
  checkedAt: string;
};

export type ExamGuide = {
  id: ExamGuideId;
  name: Bilingual;
  summary: Bilingual;
  sections: ExamGuideSection[];
  resources: ExamResource[];
};

export const SECTION_IDS = [
  "about",
  "format",
  "listening-scoring",
  "writing-scoring",
  "practice",
] as const;

/** What's wrong with a guide, or nothing (the tests and the build). */
export function examGuideProblems(value: unknown): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = value as any;
  const problems: string[] = [];
  const bilingual = (b: unknown) =>
    !!b &&
    typeof (b as Bilingual).zh === "string" &&
    (b as Bilingual).zh.trim() !== "" &&
    typeof (b as Bilingual).en === "string" &&
    (b as Bilingual).en.trim() !== "";
  if (!(EXAM_GUIDES as readonly unknown[]).includes(g?.id)) problems.push("id");
  if (!bilingual(g?.name)) problems.push("name");
  if (!bilingual(g?.summary)) problems.push("summary");
  const ids = (g?.sections ?? []).map((s: ExamGuideSection) => s.id);
  if (SECTION_IDS.some((id) => !ids.includes(id))) problems.push("sections");
  for (const s of g?.sections ?? []) {
    if (
      !bilingual(s.heading) ||
      !s.paragraphs?.zh?.length ||
      !s.paragraphs?.en?.length
    ) {
      problems.push(`section ${s.id}`);
    }
  }
  const resources = g?.resources ?? [];
  if (resources.length < 1) problems.push("resources");
  for (const r of resources) {
    if (
      !bilingual(r.title) ||
      !r.publisher ||
      !/^https:\/\//.test(r.url) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt)
    ) {
      problems.push(`resource ${r.url}`);
    }
  }
  return problems;
}

export const pick = (b: Bilingual, locale: string) =>
  locale === "en" ? b.en : b.zh;
