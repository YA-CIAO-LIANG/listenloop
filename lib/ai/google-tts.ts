import { postGoogleJson } from "./http";
import { voiceId, type SpeechProvider } from "./types";
import { GOOGLE_VOICES } from "./voices";

/** In the audio cache key: bump when voices or audio settings change. */
export const GOOGLE_TTS_ID = "google-tts/standard/v1";

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

/** Cloud Text-to-Speech (D28): MP3, one request per sentence. */
export function googleSpeech(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): SpeechProvider {
  return {
    id: GOOGLE_TTS_ID,
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
      return {
        data: Uint8Array.from(Buffer.from(result.audioContent, "base64")),
        mimeType: "audio/mpeg",
      };
    },
  };
}
