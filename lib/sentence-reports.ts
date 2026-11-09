/**
 * Reporting a problem with one sentence (D113): what can be wrong, and
 * the checks for a report the browser sends.
 */
export const SENTENCE_REPORT_KINDS = ["translation", "notes", "audio"] as const;
export type SentenceReportKind = (typeof SENTENCE_REPORT_KINDS)[number];

export const SENTENCE_REPORT_NOTE_MAX = 500;

export type SentenceReportInput = {
  videoId: string;
  version: number | null;
  index: number;
  kind: SentenceReportKind;
  note: string | null;
};

/** A report from the browser, checked; or null. */
export function parseSentenceReport(
  value: unknown,
): SentenceReportInput | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (
    typeof r.videoId !== "string" ||
    r.videoId.length === 0 ||
    r.videoId.length > 100 ||
    !Number.isInteger(r.index) ||
    (r.index as number) < 0 ||
    !(SENTENCE_REPORT_KINDS as readonly unknown[]).includes(r.kind) ||
    (r.version !== null &&
      r.version !== undefined &&
      !(Number.isInteger(r.version) && (r.version as number) >= 1))
  ) {
    return null;
  }
  const note = typeof r.note === "string" ? r.note.trim() : "";
  if (note.length > SENTENCE_REPORT_NOTE_MAX) return null;
  return {
    videoId: r.videoId,
    version: (r.version as number | undefined) ?? null,
    index: r.index as number,
    kind: r.kind as SentenceReportKind,
    note: note || null,
  };
}

export const SENTENCE_REPORT_RESOLUTIONS = ["fixed", "dismissed"] as const;
export type SentenceReportResolution =
  (typeof SENTENCE_REPORT_RESOLUTIONS)[number];

export type OpenSentenceReport = {
  id: string;
  video_id: string;
  sentence_index: number;
  kind: string;
  note: string | null;
  created_at: string;
};

/** Open reports grouped by sentence, in the order they first came. */
export function groupSentenceReports(reports: readonly OpenSentenceReport[]): {
  videoId: string;
  sentenceIndex: number;
  reports: (OpenSentenceReport & { kind: SentenceReportKind })[];
}[] {
  const groups = new Map<
    string,
    {
      videoId: string;
      sentenceIndex: number;
      reports: (OpenSentenceReport & { kind: SentenceReportKind })[];
    }
  >();
  for (const report of reports) {
    if (!(SENTENCE_REPORT_KINDS as readonly string[]).includes(report.kind)) {
      continue;
    }
    const key = `${report.video_id}#${report.sentence_index}`;
    const group = groups.get(key) ?? {
      videoId: report.video_id,
      sentenceIndex: report.sentence_index,
      reports: [],
    };
    group.reports.push(
      report as OpenSentenceReport & { kind: SentenceReportKind },
    );
    groups.set(key, group);
  }
  return [...groups.values()];
}
