/**
 * Makes the sample clip each voice plays in the voice menu, with the real
 * Azure Speech voices in lib/ai/voices.ts (D39):
 *
 *   npm run voices:samples          # prints what it would cost, calls nothing
 *   npm run voices:samples -- --yes # makes the 8 clips
 *
 * Reads AZURE_SPEECH_KEY and AZURE_SPEECH_REGION from .env.local and
 * writes public/voices/<voice id>.mp3. Run it again after changing a
 * voice; the clips ship with the app, so playing them costs no usage.
 * Real calls only with Joe's go-ahead (CLAUDE.md, "AI 供應者與測試").
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AZURE_VOICES } from "../lib/ai/voices.ts";

const SAMPLE =
  "Hi, I'm one of the voices you can choose. Let's practice listening together, one sentence at a time.";
const voices = Object.entries(AZURE_VOICES);
const chars = [...SAMPLE].length * voices.length;

if (!process.argv.includes("--yes")) {
  console.log(
    `Would make ${voices.length} clips: ${voices.length} Azure Speech calls, ${chars} characters (free on F0). Add --yes to make them.`,
  );
  process.exit(0);
}

const apiKey = process.env.AZURE_SPEECH_KEY?.trim();
const region = process.env.AZURE_SPEECH_REGION?.trim();
if (!apiKey || !region || !/^[a-z0-9]+$/.test(region)) {
  console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.local.");
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "public", "voices");
mkdirSync(dir, { recursive: true });

for (const [id, voice] of voices) {
  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "content-type": "application/ssml+xml",
        "ocp-apim-subscription-key": apiKey,
        "x-microsoft-outputformat": "audio-24khz-48kbitrate-mono-mp3",
        "user-agent": "ListenLoop",
      },
      // SAMPLE has no characters that need escaping in XML except the
      // apostrophes, which are fine inside an element.
      body: `<speak version="1.0" xml:lang="${voice.locale}"><voice name="${voice.name}">${SAMPLE}</voice></speak>`,
    },
  );
  if (!response.ok) {
    console.error(`${id}: HTTP ${response.status} ${await response.text()}`);
    process.exit(1);
  }
  writeFileSync(
    join(dir, `${id}.mp3`),
    new Uint8Array(await response.arrayBuffer()),
  );
  console.log(`${id}: ${voice.name}`);
}
console.log(`Done: ${voices.length} calls, ${chars} characters, US$0 on F0.`);
