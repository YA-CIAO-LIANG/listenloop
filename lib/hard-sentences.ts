/**
 * "Hard sentences" on the admin dashboard (D56): shadowing trouble reports
 * (D52) grouped by sentence, most skipped first, then lowest average
 * coverage, so the sentences most worth fixing come first.
 */
export type IssueRow = {
  video_id: string;
  sentence_index: number;
  coverages: number[];
  skipped: boolean;
  created_at: string;
};

export type HardSentence = {
  videoId: string;
  sentenceIndex: number;
  reports: number;
  skips: number;
  /** Mean of every reported attempt's coverage, 0–1. */
  averageCoverage: number;
  lastReported: string;
};

export function rankHardSentences(rows: readonly IssueRow[]): HardSentence[] {
  const groups = new Map<
    string,
    HardSentence & { attempts: number; sum: number }
  >();
  for (const row of rows) {
    const key = `${row.video_id}#${row.sentence_index}`;
    const group = groups.get(key) ?? {
      videoId: row.video_id,
      sentenceIndex: row.sentence_index,
      reports: 0,
      skips: 0,
      averageCoverage: 0,
      lastReported: row.created_at,
      attempts: 0,
      sum: 0,
    };
    group.reports += 1;
    if (row.skipped) group.skips += 1;
    group.attempts += row.coverages.length;
    group.sum += row.coverages.reduce((total, c) => total + c, 0);
    if (row.created_at > group.lastReported)
      group.lastReported = row.created_at;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ attempts, sum, ...group }) => ({
      ...group,
      averageCoverage: attempts > 0 ? sum / attempts : 0,
    }))
    .sort(
      (a, b) =>
        b.skips - a.skips ||
        a.averageCoverage - b.averageCoverage ||
        b.reports - a.reports,
    );
}
