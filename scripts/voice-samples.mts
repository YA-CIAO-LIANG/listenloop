/**
 * Makes the sample clip each voice card plays (VoicePicker), with the real
 * Cloud Text-to-Speech voices in lib/ai/voices.ts:
 *
 *   npm run voices:samples
 *
 * Reads GOOGLE_CLOUD_API_KEY from .env.local and writes
 * public/voices/<voice id>.mp3. Run it again after changing a voice; the
 * clips ship with the app, so playing them costs no usage.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GOOGLE_VOICES } from "../lib/ai/voices.ts";

const SAMPLE =
  "Hi, I'm one of the voices you can choose. Let's practice listening together, one sentence at a time.";
const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
if (!apiKey) {
  console.error("Set GOOGLE_CLOUD_API_KEY in .env.local first.");
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "public", "voices");
mkdirSync(dir, { recursive: true });

let chars = 0;
for (const [id, voice] of Object.entries(GOOGLE_VOICES)) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      input: { text: SAMPLE },
      voice,
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!response.ok) {
    console.error(`${id}: ${response.status} ${await response.text()}`);
    process.exit(1);
  }
  const { audioContent } = (await response.json()) as { audioContent: string };
  writeFileSync(join(dir, `${id}.mp3`), Buffer.from(audioContent, "base64"));
  chars += SAMPLE.length;
  console.log(`${id}: ${voice.name}`);
}
console.log(`Done: ${chars} characters.`);
