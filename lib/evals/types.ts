import type {
  DescribeInput,
  RevisionInput,
  TextLanguage,
} from "@/lib/ai/types";
import type { CompositionPrompt } from "@/lib/custom-practice/generation";

/**
 * The golden set's shapes (D150): what each case sends, and the checks
 * its answer must pass after the same processing production does.
 */

/** A rule, as data: the golden set stays a list of plain objects. */
export type Rule =
  // Any operation
  | { kind: "valid" }
  | { kind: "noFullWidth" }
  // translate
  | { kind: "sameLineCount" }
  | { kind: "namesKept"; names: string[] }
  | { kind: "taiwanUsage" }
  | { kind: "includes"; line: number; anyOf: string[] }
  // segment
  | { kind: "modelSplitKept" }
  | { kind: "pieceCount"; min: number; max: number }
  | { kind: "keptWhole"; texts: string[] }
  | { kind: "pieceWordsMax"; max: number }
  // annotate
  | { kind: "notesMaxChars"; max: number }
  | { kind: "rawNotesMaxChars"; max: number }
  | { kind: "quotesInSentence" }
  | { kind: "ipaSlashes" }
  | { kind: "hasVocab" }
  | { kind: "noReduction"; soundsLike: string[] }
  // compose
  | { kind: "wordsWithin"; ratio: number }
  | { kind: "sentenceWords"; min: number; max: number; share: number }
  | { kind: "noSpeakerLabels" }
  | { kind: "titleExact"; en?: string; zh?: string }
  | { kind: "subtitleMax"; max: number }
  | { kind: "mentions"; anyOf: string[] }
  // describe
  | { kind: "noOpening"; words: string[] }
  // revise
  | { kind: "status"; is: "changed" | "unchanged" | "refused" }
  | { kind: "changedShare"; atLeast: number }
  | { kind: "lineCount"; compared: "fewer" | "more" }
  | { kind: "hasReason" };

export type RuleKind = Rule["kind"];

/** Joe's earlier reports each case guards against. */
export type Regression = {
  /** The decision that recorded it, e.g. "D117". */
  decision: string;
  /** What went wrong, in Chinese, for the report. */
  issue: string;
};

type CaseBase = {
  id: string;
  /** What the case covers, in Chinese, for the report. */
  title: string;
  rules: Rule[];
  /** What the AI judge grades, in Chinese; no judge when absent. */
  judge?: string;
  regression?: Regression;
};

export type EvalCase =
  | (CaseBase & {
      operation: "translate";
      input: { lines: string[]; from: TextLanguage; to: TextLanguage };
    })
  | (CaseBase & {
      operation: "segment";
      input: { lines: string[]; language: "en" | "zh" };
    })
  | (CaseBase & { operation: "annotate"; input: { sentences: string[] } })
  | (CaseBase & { operation: "compose"; input: CompositionPrompt })
  | (CaseBase & { operation: "describe"; input: DescribeInput })
  | (CaseBase & { operation: "revise"; input: RevisionInput });

export type EvalOperation = EvalCase["operation"];

/** One rule's result. */
export type RuleResult = { kind: RuleKind; pass: boolean; detail: string };

/** The judge's grade: 1 (poor) to 5 (excellent), with why, in Chinese. */
export type JudgeGrade = { score: number; reason: string };

/** What one case scored. */
export type CaseResult = {
  id: string;
  operation: EvalOperation;
  /** The processed answer, as shown in the report. */
  output: unknown;
  rules: RuleResult[];
  judge: JudgeGrade | null;
  /** Out of 100. */
  score: number;
  /** The recorded request this came from. */
  requestHash: string;
  /** What the recording cost, in US$ (generation and judging). */
  costUsd: number;
};

/** A run's results, saved as evals/baseline.json. */
export type EvalBaseline = {
  /** Hash of every case's request: one value per prompt and model version. */
  version: string;
  judgeVersion: number;
  model: string;
  /** The mean of the case scores, out of 100, to 2 decimals. */
  total: number;
  byOperation: Record<string, number>;
  cases: { id: string; score: number; requestHash: string }[];
};

/** A recorded exchange: the request (without keys) and the answer. */
export type EvalFixture = {
  requestHash: string;
  request: unknown;
  /** The HTTP status; 200 when absent. */
  status?: number;
  response: unknown;
};
