/**
 * LINE Login (D101), handled here rather than as a Supabase provider:
 * Supabase has no LINE provider, and LINE's web login signs its id_token
 * with the channel secret (HS256), which a custom OIDC provider can't
 * check. So the server does the OAuth code exchange, has LINE verify the
 * id_token (its /verify endpoint), and signs the person into the Supabase
 * account with that email (D101: one account per email).
 *
 * Needs LINE_CHANNEL_ID and LINE_CHANNEL_SECRET (LINE Developers →
 * a LINE Login channel) and the channel's email permission; without
 * them the LINE button is hidden.
 */
export const LINE_AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
export const LINE_TOKEN = "https://api.line.me/oauth2/v2.1/token";
export const LINE_VERIFY = "https://api.line.me/oauth2/v2.1/verify";

/** Cookie holding state, nonce, and where to go back, for 10 minutes. */
export const LINE_COOKIE = "ll-line-login";

export function lineConfig(): { channelId: string; secret: string } | null {
  const channelId = process.env.LINE_CHANNEL_ID?.trim();
  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  return channelId && secret ? { channelId, secret } : null;
}

export const lineEnabled = () => lineConfig() !== null;

export function lineAuthorizeUrl(
  channelId: string,
  redirectUri: string,
  state: string,
  nonce: string,
): string {
  const url = new URL(LINE_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", channelId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("scope", "openid profile email");
  return url.toString();
}

export type LineIdentity = { sub: string; email: string | null; name: string };

/**
 * Swaps the code for tokens and has LINE verify the id_token (signature,
 * audience, expiry, and our nonce). Null if anything doesn't check out.
 */
export async function lineIdentity(
  code: string,
  redirectUri: string,
  nonce: string,
  config: { channelId: string; secret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<LineIdentity | null> {
  const form = (values: Record<string, string>) => ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString(),
  });
  const token = await fetchImpl(
    LINE_TOKEN,
    form({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.channelId,
      client_secret: config.secret,
    }),
  ).catch(() => null);
  if (!token?.ok) return null;
  const { id_token: idToken } = (await token.json()) as { id_token?: string };
  if (!idToken) return null;
  const verified = await fetchImpl(
    LINE_VERIFY,
    form({ id_token: idToken, client_id: config.channelId, nonce }),
  ).catch(() => null);
  if (!verified?.ok) return null;
  const claims = (await verified.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    nonce?: string;
  };
  if (!claims.sub || claims.nonce !== nonce) return null;
  return {
    sub: claims.sub,
    email: claims.email ? claims.email.toLowerCase() : null,
    name: claims.name ?? "",
  };
}
