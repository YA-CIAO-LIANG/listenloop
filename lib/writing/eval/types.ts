import type { ErrorType, WritingType } from "../types";

/**
 * A case of the writing eval's golden set (D188): a made-up essay (never
 * a real learner's: the repository is public) and what good feedback on
 * it must do.
 */
export type Declined = "ghostwrite" | "off-task" | "too-short";

export type WritingEvalCase = {
  id: string;
  /** What the case is about, for the report. */
  category:
    | "level"
    | "errors"
    | "exam"
    | "ghostwrite"
    | "injection"
    | "short"
    | "long"
    | "off-task";
  type: WritingType;
  task: string;
  words: { min: number; max: number };
  essay: string;
  expect: {
    /**
     * The answer must decline this way (ghostwrite, off-task, too-short),
     * or any of several when more than one fits (a request in Chinese
     * only is also under 20 English words).
     */
    declined?: Declined | Declined[];
    /** At least one issue (main or more) of each of these kinds. */
    types?: ErrorType[];
    /** Words of the essay a flagged quote must contain (the planted mistakes). */
    quotes?: string[];
    /** The 0–100 score must fall in this range. */
    percent?: [number, number];
  };
  /** Scored twice to check the score is stable. */
  twice?: boolean;
};
