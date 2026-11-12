import { halfWidth, textLength } from "@/lib/content-fixes";
import {
  checkGeneratedText,
  type GeneratedText,
} from "@/lib/custom-practice/generation";
import { richNotesFromModel } from "@/lib/custom-practice/notes";
import { checkRevision, type Revision } from "@/lib/custom-practice/revise";
import type { RichNotes } from "@/lib/custom-practice/rich-notes";
import { checkedSegments } from "@/lib/custom-practice/split";
import { subtitleFromModel } from "@/lib/custom-practice/subtitle";
import { keepTypedTitles } from "@/lib/titles";
import type { EvalCase } from "./types";

/**
 * A case's answer after the same checks and clean-up production applies
 * (D150): the eval grades the whole AI step, not only the model, so a
 * change to this code is graded too, from the same recordings.
 */
export type Processed =
  | { operation: "translate"; lines: string[] | null }
  | {
      operation: "segment";
      pieces: string[];
      /** Every line's pieces were the model's own (no rule fallback). */
      modelKept: boolean;
    }
  | {
      operation: "annotate";
      notes: RichNotes[];
      /** Characters of each sentence's notes as the model wrote them. */
      rawChars: number[];
    }
  | { operation: "compose"; text: GeneratedText | null }
  | {
      operation: "describe";
      titleEn: string;
      titleZh: string;
      subtitle: string | null;
    }
  | { operation: "revise"; revision: Revision | null };

const squeeze = (text: string) => text.replace(/\s+/g, "");

/** What `raw` (the provider's value) becomes in production. */
export function processAnswer(evalCase: EvalCase, raw: unknown): Processed {
  switch (evalCase.operation) {
    case "translate": {
      // As translateCached keeps each line (lib/custom-practice/notes.ts).
      const { lines, to } = evalCase.input;
      const answer = Array.isArray(raw) ? raw : [];
      const checked = answer.map((value) =>
        typeof value === "string" && value.trim()
          ? to === "zh-Hant"
            ? halfWidth(value.trim())
            : value.trim()
          : null,
      );
      const ok = checked.length === lines.length && !checked.includes(null);
      return {
        operation: "translate",
        lines: ok ? (checked as string[]) : null,
      };
    }
    case "segment": {
      const { lines, language } = evalCase.input;
      const perLine = Array.isArray(raw) ? raw : [];
      const modelKept =
        perLine.length === lines.length &&
        lines.every((line, i) => {
          const pieces: unknown = perLine[i];
          return (
            Array.isArray(pieces) &&
            pieces.length > 0 &&
            pieces.every((p) => typeof p === "string") &&
            squeeze(pieces.join("")) === squeeze(line)
          );
        });
      return {
        operation: "segment",
        pieces: checkedSegments(lines, raw, language),
        modelKept,
      };
    }
    case "annotate": {
      const { sentences } = evalCase.input;
      const items =
        typeof raw === "object" && raw !== null
          ? (raw as { sentences?: unknown }).sentences
          : undefined;
      const list = Array.isArray(items) ? items : [];
      const rawChars = sentences.map((_, i) =>
        textLength(
          list.find((item) => (item as { index?: unknown })?.index === i) ??
            null,
        ),
      );
      return {
        operation: "annotate",
        notes: richNotesFromModel(raw, sentences),
        rawChars,
      };
    }
    case "compose":
      return {
        operation: "compose",
        text: checkGeneratedText(raw, evalCase.input.words),
      };
    case "describe": {
      // As the "write titles" action keeps them (app/materials/actions.ts).
      const typed = {
        en: evalCase.input.titleEn,
        zh: evalCase.input.titleZh,
      };
      const written = (raw ?? {}) as { titleEn?: unknown; titleZh?: unknown };
      const titles = keepTypedTitles(typed, {
        en: typeof written.titleEn === "string" ? written.titleEn : "",
        zh: typeof written.titleZh === "string" ? written.titleZh : "",
      });
      return {
        operation: "describe",
        titleEn: titles.en,
        titleZh: titles.zh,
        subtitle: subtitleFromModel(raw),
      };
    }
    case "revise":
      return {
        operation: "revise",
        revision: checkRevision(raw, evalCase.input.lines),
      };
  }
}

/** The processed answer as plain data, for the report and the judge. */
export function shownAnswer(processed: Processed): unknown {
  const rest: Partial<Processed> = { ...processed };
  delete rest.operation;
  return rest;
}
