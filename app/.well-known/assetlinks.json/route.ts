import { assetLinksFromEnv } from "@/lib/twa";

/**
 * Digital Asset Links for the Android app (D178): the package and its
 * signing-key fingerprints from TWA_PACKAGE_NAME and
 * TWA_SHA256_FINGERPRINTS (lib/twa.ts); [] when they aren't set. The
 * proxy skips paths with an extension, so neither maintenance mode nor
 * the sign-in session touches it, and it never redirects (Android's
 * verifier doesn't follow redirects).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(assetLinksFromEnv(), {
    headers: {
      "content-type": "application/json",
      // Android checks at install time; an hour keeps a changed key quick.
      "cache-control": "public, max-age=3600",
    },
  });
}
