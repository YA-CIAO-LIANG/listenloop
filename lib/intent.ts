/**
 * Steps toward paying (D93; the P2 fake doors). Recorded by the server in
 * intent_events with who (account or visitor), what, and from where.
 */
export const INTENT_STEPS = [
  "pricing_view",
  "interval_switch",
  "subscribe_click",
  "waitlist_join",
  "unlock_click",
] as const;
export type IntentStep = (typeof INTENT_STEPS)[number];

/** The pages and features that send people toward paying. */
export const INTENT_SOURCES = [
  "direct",
  "header",
  "footer",
  "trial-used",
  "custom-rules",
  "color-unlock",
  "classroom",
  "youtube",
  "speed",
  "stats",
  "account",
] as const;
export type IntentSource = (typeof INTENT_SOURCES)[number];

export type Intent = {
  step: IntentStep;
  plan?: string;
  interval?: string;
  item?: string;
  source?: IntentSource;
};

/** Where this browser keeps its random visitor id. */
export const VISITOR_COOKIE = "ll-visitor";

const isShortId = (value: unknown, max: number): value is string =>
  typeof value === "string" &&
  /^[a-z0-9-]+$/.test(value) &&
  value.length <= max;

export const isIntentSource = (value: unknown): value is IntentSource =>
  (INTENT_SOURCES as readonly unknown[]).includes(value);

/** Validates what the browser sent; anything else returns null. */
export function parseIntent(value: unknown): Intent | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  if (!(INTENT_STEPS as readonly unknown[]).includes(data.step)) return null;
  const intent: Intent = { step: data.step as IntentStep };
  for (const [key, max] of [
    ["plan", 32],
    ["interval", 16],
    ["item", 32],
  ] as const) {
    if (data[key] === undefined) continue;
    if (!isShortId(data[key], max)) return null;
    intent[key] = data[key];
  }
  if (data.source !== undefined) {
    if (!isIntentSource(data.source)) return null;
    intent.source = data.source;
  }
  return intent;
}
