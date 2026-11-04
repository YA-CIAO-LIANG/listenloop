import type { LanguageProvider, SpeechAudio, SpeechProvider } from "./types";

/**
 * Fake providers for tests and local development: no network, no cost,
 * and the same output for the same input.
 */
export const fakeLanguage: LanguageProvider = {
  id: "fake",
  async translate(texts, { to }) {
    return texts.map((text) => `[${to}] ${text}`);
  },
  // Each sentence's longest word as vocabulary; every third sentence gets
  // a grammar point on its first two words.
  async annotate(sentences) {
    const words = (sentence: string) => sentence.match(/[A-Za-z']+/g) ?? [];
    return {
      vocab: sentences.flatMap((sentence, i) => {
        const word = [...words(sentence)].sort(
          (a, b) => b.length - a.length,
        )[0];
        return word
          ? [
              {
                sentence: i,
                word: word.toLowerCase(),
                pos: "n.",
                zh: `[zh-Hant] ${word.toLowerCase()}`,
                example: `An example with ${word.toLowerCase()}.`,
              },
            ]
          : [];
      }),
      grammar: sentences.flatMap((sentence, i) =>
        i % 3 === 0 && words(sentence).length >= 2
          ? [
              {
                sentence: i,
                point: words(sentence).slice(0, 2).join(" "),
                explanation: `[zh-Hant] ${sentence}`,
                example: sentence,
              },
            ]
          : [],
      ),
    };
  },
};

const SAMPLE_RATE = 8000;
const SECONDS_PER_WORD = 0.4;

/**
 * Silent WAV audio, 0.4 s per word (at least 1 s), so players and timing
 * can be tested with a real, playable file.
 */
export function silentWav(seconds: number): Uint8Array {
  const samples = Math.round(seconds * SAMPLE_RATE);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // bytes per second (8-bit mono)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is the midpoint
  return bytes;
}

export const fakeSpeech: SpeechProvider = {
  id: "fake",
  async synthesize(text: string): Promise<SpeechAudio> {
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      data: silentWav(Math.max(1, words * SECONDS_PER_WORD)),
      mimeType: "audio/wav",
    };
  },
};
