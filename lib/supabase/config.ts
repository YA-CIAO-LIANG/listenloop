/**
 * Supabase settings from the environment. Accounts are optional
 * (docs/decisions.md D2): without both variables the app runs as before,
 * progress in localStorage only, and nothing account-related shows.
 */
export type SupabaseConfig = {
  /** https://<ref>.supabase.co */
  url: string;
  /** The publishable (anon) key: public, safe in the browser. */
  publishableKey: string;
};

/**
 * The config if both values look usable, else null. The URL must be
 * https, except on this machine (127.0.0.1, localhost), where a local
 * Supabase or the end-to-end tests' stand-in runs over http (D32).
 */
export function readSupabaseConfig(
  url: string | undefined,
  publishableKey: string | undefined,
): SupabaseConfig | null {
  const trimmedUrl = url?.trim().replace(/\/+$/, "");
  const trimmedKey = publishableKey?.trim();
  if (!trimmedUrl || !trimmedKey) return null;
  try {
    const { protocol, hostname } = new URL(trimmedUrl);
    const local = hostname === "localhost" || hostname === "127.0.0.1";
    if (protocol !== "https:" && !(protocol === "http:" && local)) {
      return null;
    }
  } catch {
    return null;
  }
  return { url: trimmedUrl, publishableKey: trimmedKey };
}

// NEXT_PUBLIC_* must be read literally so Next.js inlines them into the
// browser bundle. The variable keeps the name ANON_KEY; it holds the new
// publishable key (docs/decisions.md D10).
export const supabaseConfig = readSupabaseConfig(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Whether sign-in and cloud progress are available. */
export const accountsEnabled = supabaseConfig !== null;

/** The Storage bucket with generated speech (docs/decisions.md D22). */
export const SPEECH_BUCKET = "speech";

/** The public URL of a generated audio file, or null without Supabase. */
export function speechAudioUrl(
  path: string,
  config: SupabaseConfig | null = supabaseConfig,
): string | null {
  if (!config) return null;
  return `${config.url}/storage/v1/object/public/${SPEECH_BUCKET}/${encodeURIComponent(path)}`;
}
