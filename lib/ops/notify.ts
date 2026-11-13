import type { OpsAlert } from "./alerts";

/**
 * Sending an alert (D156): to a Discord webhook when DISCORD_WEBHOOK_URL
 * is set, otherwise nowhere (the alert is still kept for /admin/ops).
 * Messages carry no personal data: counts and amounts only.
 */

const DISCORD_HOST =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//;

/** The webhook URL if it looks like Discord's, else null. */
export function discordWebhook(
  raw: string | undefined = process.env.DISCORD_WEBHOOK_URL,
): string | null {
  const url = raw?.trim();
  return url && DISCORD_HOST.test(url) ? url : null;
}

/** Discord allows 2,000 characters a message. */
const MAX = 1_900;

export function discordText(title: string, lines: string[]): string {
  const text = [`**${title}**`, ...lines].join("\n");
  return text.length > MAX ? `${text.slice(0, MAX)}…` : text;
}

export function alertLines(alerts: OpsAlert[]): string[] {
  return alerts.map(
    (alert) => `${alert.level === "critical" ? "🔴" : "🟠"} ${alert.message}`,
  );
}

/** Posts `content`; true when Discord took it. Never throws. */
export async function sendDiscord(
  content: string,
  url: string | null = discordWebhook(),
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // No @everyone or role pings from an alert's text.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
