import { countChars } from "@/lib/usage";
import { postGoogleJson, probeProvider } from "./http";
import { SPEECH_PRICES_PER_M_CHARS } from "./pricing";
import { voiceId, type SpeechProvider } from "./types";
import { GOOGLE_VOICES } from "./voices";

/** In the audio cache key: bump when voices or audio settings change. */
export const GOOGLE_TTS_ID = "google-tts/chirp3-hd/v1";

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

/** Cloud Text-to-Speech (D28, D29): MP3, one request per sentence. */
export function googleSpeech(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): SpeechProvider {
  return {
    id: GOOGLE_TTS_ID,
    // Listing voices is free and needs the same key (D49).
    checkConnection: () =>
      probeProvider(
        "https://texttospeech.googleapis.com/v1/voices?languageCode=en-US",
        { method: "GET", headers: { "x-goog-api-key": apiKey } },
        fetchImpl,
        (status) => status === 200,
      ),
    async synthesize(text, voice) {
      const result = (await postGoogleJson(
        ENDPOINT,
        apiKey,
        {
          input: { text },
          voice: GOOGLE_VOICES[voiceId(voice) as keyof typeof GOOGLE_VOICES],
          audioConfig: { audioEncoding: "MP3" },
        },
        fetchImpl,
        "Text-to-Speech",
      )) as { audioContent?: unknown };
      if (typeof result.audioContent !== "string" || !result.audioContent) {
        throw new Error("Text-to-Speech: no audio in the response");
      }
      const chars = countChars([text]);
      return {
        value: {
          data: Uint8Array.from(Buffer.from(result.audioContent, "base64")),
          mimeType: "audio/mpeg",
        },
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          chars,
          costUsd: (chars * SPEECH_PRICES_PER_M_CHARS.googleChirp3Hd) / 1e6,
        },
      };
    },
  };
}
