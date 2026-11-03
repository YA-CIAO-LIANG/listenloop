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

/** The config if both values look usable, else null. */
export function readSupabaseConfig(
  url: string | undefined,
  publishableKey: string | undefined,
): SupabaseConfig | null {
  const trimmedUrl = url?.trim().replace(/\/+$/, "");
  const trimmedKey = publishableKey?.trim();
  if (!trimmedUrl || !trimmedKey) return null;
  try {
    if (new URL(trimmedUrl).protocol !== "https:") return null;
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
