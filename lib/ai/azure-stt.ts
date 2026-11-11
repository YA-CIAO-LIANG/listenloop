import { postToProvider, probeProvider } from "./http";
import { TRANSCRIBE_PRICES_PER_HOUR } from "./pricing";
import { isAzureRegion } from "./azure-speech";
import {
  ProviderError,
  type Billed,
  type Heard,
  type TranscribeProvider,
} from "./types";

/** Logged as the provider; bump when the request changes. */
export const AZURE_STT_ID = "azure-stt/short-audio/v1";

/** Azure counts time in 100-nanosecond ticks. */
const TICKS_PER_SECOND = 10_000_000;

type ShortAudioAnswer = {
  RecognitionStatus?: string;
  DisplayText?: string;
  Offset?: number;
  Duration?: number;
};

/**
 * What the short-audio answer says was heard: the text with punctuation,
 * where in the piece it was, or nothing for silence and noise. Anything
 * else is a failure.
 */
export function readShortAudio(answer: unknown, seconds: number): Heard {
  const data = (answer ?? {}) as ShortAudioAnswer;
  const status = data.RecognitionStatus;
  if (
    status === "NoMatch" ||
    status === "InitialSilenceTimeout" ||
    status === "BabbleTimeout"
  ) {
    return { text: "", offset: 0, duration: 0 };
  }
  if (status !== "Success" || typeof data.DisplayText !== "string") {
    throw new ProviderError(
      "failed",
      `Azure speech to text: status ${String(status)}`,
      undefined,
      { status: 200, code: String(status ?? "no-status").slice(0, 60) },
    );
  }
  const offset = Math.max(0, (data.Offset ?? 0) / TICKS_PER_SECOND);
  const duration = Math.max(0, (data.Duration ?? 0) / TICKS_PER_SECOND);
  return {
    text: data.DisplayText.replace(/\s+/g, " ").trim(),
    offset: Math.min(offset, seconds),
    duration: Math.min(duration, Math.max(0, seconds - offset)),
  };
}

/**
 * Azure Speech to text, short audio REST (D130): one request per piece
 * of up to 60 seconds of 16 kHz mono WAV, the "conversation" mode, with
 * punctuation. It's in every region, including the one our text to
 * speech uses (fast transcription isn't), and the free F0 tier includes
 * 5 hours a month, so the cost is 0; past that Azure answers 403.
 */
export function azureTranscriber(
  apiKey: string,
  region: string,
  fetchImpl: typeof fetch = fetch,
): TranscribeProvider {
  if (!isAzureRegion(region)) {
    throw new Error(`Not an Azure region: ${region}`);
  }
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=simple&profanity=raw`;
  return {
    id: AZURE_STT_ID,
    // The same free voice list as text to speech: same key and region.
    checkConnection: () =>
      probeProvider(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        { method: "GET", headers: { "ocp-apim-subscription-key": apiKey } },
        fetchImpl,
        (status) => status === 200,
      ),
    async transcribe(wav, seconds): Promise<Billed<Heard>> {
      const response = await postToProvider(
        url,
        {
          headers: {
            "content-type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            accept: "application/json",
            "ocp-apim-subscription-key": apiKey,
            "user-agent": "ListenLoop",
          },
          body: wav,
        },
        fetchImpl,
        "Azure speech to text",
      );
      const heard = readShortAudio(await response.json(), seconds);
      return {
        value: heard,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          chars: 0,
          costUsd: (seconds / 3600) * TRANSCRIBE_PRICES_PER_HOUR.azureF0,
        },
      };
    },
  };
}
