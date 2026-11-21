import type { WritingPrompt } from "@/lib/writing/types";
import { writingPromptProblems } from "@/lib/writing/validate";
import dailyPerfectWeekend from "./prompts/daily-perfect-weekend.json";

/**
 * Every official writing prompt (D187), in library order. Imported
 * statically so the JSON ships with the build, and validated at import:
 * a published prompt with problems fails the build. tests/writing-prompts
 * checks that every JSON file in prompts/ is listed here.
 */
const all = [dailyPerfectWeekend] as unknown as WritingPrompt[];

for (const prompt of all) {
  const problems = writingPromptProblems(prompt);
  if (problems.length) {
    throw new Error(
      `data/writing/prompts/${prompt.id}.json: ${problems.join(", ")}`,
    );
  }
}

/** Every prompt, drafts included (the timing-style admin views). */
export const allWritingPrompts: readonly WritingPrompt[] = all;

/** The published prompts. */
export const writingPrompts: readonly WritingPrompt[] = all.filter(
  (p) => !p.draft,
);

export function getWritingPrompt(id: string): WritingPrompt | undefined {
  return writingPrompts.find((p) => p.id === id);
}
