/**
 * No secret in the browser's JavaScript (D159): after a build, scans
 * everything Next.js sends to browsers (.next/static) for the names of
 * server-only settings and for the test builds' stand-in secret values.
 * A name there means server code (or a secret) leaked into the client.
 * Only NEXT_PUBLIC_* settings may reach the browser, and they're public.
 *
 *   npm run build:e2e && node scripts/check-client-bundle.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "AZURE_OPENAI_API_KEY",
  "AZURE_SPEECH_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_CLOUD_API_KEY",
  "YOUTUBE_API_KEY",
  "LINE_CHANNEL_SECRET",
  "PAYMENTS_WEBHOOK_SECRET",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "DISCORD_WEBHOOK_URL",
  "TURNSTILE_SECRET_KEY",
  "BACKUP_PASSPHRASE",
  "ADMIN_EMAILS",
];
// The stand-in values the end-to-end setup uses for secrets.
const SECRET_VALUES = ["e2e-secret-key", "e2e-payments-secret"];

const root = ".next/static";
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

let all;
try {
  all = files(root).filter((f) => /\.(js|mjs|json|css|html)$/.test(f));
} catch {
  console.error(`${root} not found: build first.`);
  process.exit(1);
}
const found = [];
for (const file of all) {
  const text = readFileSync(file, "utf8");
  for (const needle of [...SECRET_NAMES, ...SECRET_VALUES]) {
    if (text.includes(needle)) found.push(`${file}: ${needle}`);
  }
}
if (found.length) {
  console.error("Server-only settings found in browser files:");
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`Checked ${all.length} browser files: no server-only settings.`);
