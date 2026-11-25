import { INTENT_STEPS, type IntentStep } from "./intent";

/**
 * The admin's interest page (D102): the fake doors' funnel from
 * intent_events. People are counted once per step (by account, else by
 * visitor id), so reloading the pricing page doesn't inflate it.
 */
export type IntentRow = {
  created_at: string;
  user_id: string | null;
  visitor_id: string;
  step: string;
  plan: string | null;
  billing_interval: string | null;
  source: string | null;
  /** What a step was about (an unlock's item, an upsell's feature). */
  item?: string | null;
};

/** The funnel's steps, in order (unlock clicks are their own door). */
export const FUNNEL: readonly IntentStep[] = [
  "pricing_view",
  "interval_switch",
  "subscribe_click",
  "waitlist_join",
];

const who = (row: IntentRow) => row.user_id ?? `v:${row.visitor_id}`;

export type FunnelStep = {
  step: IntentStep;
  people: number;
  /** Of the people who saw the pricing page; null for the first step. */
  rate: number | null;
};

export function funnel(rows: readonly IntentRow[]): FunnelStep[] {
  const people = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = people.get(row.step) ?? new Set<string>();
    set.add(who(row));
    people.set(row.step, set);
  }
  const first = people.get(FUNNEL[0])?.size ?? 0;
  return INTENT_STEPS.map((step) => {
    const count = people.get(step)?.size ?? 0;
    return {
      step,
      people: count,
      rate: step === FUNNEL[0] ? null : first > 0 ? count / first : 0,
    };
  });
}

/** Monday (Taiwan time) of the week a time falls in, as YYYY-MM-DD. */
export function weekOf(iso: string): string {
  const taiwan = new Date(new Date(iso).getTime() + 8 * 3_600_000);
  const day = (taiwan.getUTCDay() + 6) % 7; // Monday 0
  taiwan.setUTCDate(taiwan.getUTCDate() - day);
  return taiwan.toISOString().slice(0, 10);
}

/** People per step for each of the last `weeks` weeks, oldest first. */
export function weeklyTrend(
  rows: readonly IntentRow[],
  now: Date,
  weeks = 8,
): { week: string; counts: Record<IntentStep, number> }[] {
  const latest = weekOf(now.toISOString());
  const list: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${latest}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    list.push(d.toISOString().slice(0, 10));
  }
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${weekOf(row.created_at)}|${row.step}`;
    const set = seen.get(key) ?? new Set<string>();
    set.add(who(row));
    seen.set(key, set);
  }
  return list.map((week) => ({
    week,
    counts: Object.fromEntries(
      INTENT_STEPS.map((step) => [
        step,
        seen.get(`${week}|${step}`)?.size ?? 0,
      ]),
    ) as Record<IntentStep, number>,
  }));
}

/** How a step's people split by a field (plan, period, source), largest first. */
export function shares(
  rows: readonly IntentRow[],
  step: IntentStep,
  field: "plan" | "billing_interval" | "source" | "item",
): { value: string; people: number; share: number }[] {
  const people = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.step !== step) continue;
    const value = row[field] ?? "—";
    const set = people.get(value) ?? new Set<string>();
    set.add(who(row));
    people.set(value, set);
  }
  const total = [...people.values()].reduce((sum, s) => sum + s.size, 0);
  return [...people]
    .map(([value, set]) => ({
      value,
      people: set.size,
      share: total > 0 ? set.size / total : 0,
    }))
    .sort((a, b) => b.people - a.people);
}
