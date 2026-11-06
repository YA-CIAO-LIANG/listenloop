import { countChars } from "@/lib/usage";
import { postToProvider } from "./http";
import { SPEECH_PRICES_PER_M_CHARS } from "./pricing";
import { ProviderError, voiceId, type SpeechProvider } from "./types";
import { AZURE_VOICES } from "./voices";

/** In the audio cache key: bump when voices or audio settings change. */
export const AZURE_TTS_ID = "azure-tts/neural/v1";

/** MP3 like the Google provider's, small enough for one file a sentence. */
export const AZURE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/** Azure region names are lowercase letters and digits ("uaenorth"). */
export function isAzureRegion(region: string): boolean {
  return /^[a-z0-9]+$/.test(region);
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Text as SSML content: the text is read, never taken as markup. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

export function speechSsml(
  text: string,
  voice: { locale: string; name: string },
) {
  return `<speak version="1.0" xml:lang="${voice.locale}"><voice name="${voice.name}">${escapeXml(text)}</voice></speak>`;
}

/**
 * Azure Speech text to speech (D39): the REST API, one request per
 * sentence, MP3. On the free F0 tier, so the cost is 0; past the month's
 * free characters Azure answers 403 and nothing is charged (a config
 * failure, which only admins see).
 */
export function azureSpeech(
  apiKey: string,
  region: string,
  fetchImpl: typeof fetch = fetch,
): SpeechProvider {
  if (!isAzureRegion(region)) {
    throw new Error(`Not an Azure region: ${region}`);
  }
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  return {
    id: AZURE_TTS_ID,
    async synthesize(text, voice) {
      const response = await postToProvider(
        url,
        {
          headers: {
            "content-type": "application/ssml+xml",
            "ocp-apim-subscription-key": apiKey,
            "x-microsoft-outputformat": AZURE_OUTPUT_FORMAT,
            "user-agent": "ListenLoop",
          },
          body: speechSsml(
            text,
            AZURE_VOICES[voiceId(voice) as keyof typeof AZURE_VOICES],
          ),
        },
        fetchImpl,
        "Azure Speech",
      );
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.length === 0) {
        throw new ProviderError(
          "failed",
          "Azure Speech: no audio in the response",
        );
      }
      const chars = countChars([text]);
      return {
        value: { data, mimeType: "audio/mpeg" },
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          chars,
          costUsd: (chars * SPEECH_PRICES_PER_M_CHARS.azureF0) / 1e6,
        },
      };
    },
  };
}
