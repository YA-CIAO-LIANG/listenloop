"use client";

import { UPLOAD_LIMITS } from "@/lib/upload-audio";

/**
 * The recording's work done in the learner's browser (D130), so a video
 * never leaves their device: only its sound is uploaded, as a small MP3.
 */

/** The file's length in seconds from its metadata, before decoding it. */
export function mediaSeconds(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement("audio");
    const done = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      media.removeAttribute("src");
      resolve(seconds);
    };
    media.preload = "metadata";
    media.onloadedmetadata = () =>
      done(Number.isFinite(media.duration) ? media.duration : null);
    media.onerror = () => done(null);
    media.src = url;
  });
}

/**
 * The sound of an MP3 or MP4 as 16 kHz mono samples: the browser decodes
 * the audio track (the picture is never decoded), and an offline audio
 * graph mixes it down and resamples it.
 */
export async function decodeToMono(file: Blob): Promise<Float32Array> {
  const data = await file.arrayBuffer();
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(data);
  } finally {
    void context.close();
  }
  const rate = UPLOAD_LIMITS.sampleRate;
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * rate)),
    rate,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Samples as a mono MP3 (UPLOAD_LIMITS.bitRateKbps). The encoder loads
 * only when needed; the work pauses every few seconds of audio so the
 * page stays responsive, reporting the share done.
 */
export async function encodeMp3(
  samples: Float32Array,
  onProgress?: (share: number) => void,
): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const rate = UPLOAD_LIMITS.sampleRate;
  const encoder = new Mp3Encoder(1, rate, UPLOAD_LIMITS.bitRateKbps);
  const parts: BlobPart[] = [];
  const block = 1152 * 20;
  const pcm = new Int16Array(block);
  for (let at = 0; at < samples.length; at += block) {
    const end = Math.min(samples.length, at + block);
    for (let i = at; i < end; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i - at] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const encoded = encoder.encodeBuffer(pcm.subarray(0, end - at));
    if (encoded.length > 0) parts.push(new Uint8Array(encoded));
    if ((at / block) % 20 === 19) {
      onProgress?.(end / samples.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  const last = encoder.flush();
  if (last.length > 0) parts.push(new Uint8Array(last));
  onProgress?.(1);
  return new Blob(parts, { type: "audio/mpeg" });
}
