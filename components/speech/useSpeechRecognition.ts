"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** After the last recognized speech, this much silence ends the attempt. */
export const SILENCE_MS = 1500;

/** Nothing heard at all for this long ends the attempt as "no speech". */
export const NO_SPEECH_MS = 8000;

/**
 * Network errors in a row before giving up on recognition here. Some
 * browsers expose the API but can't reach a recognition service, so every
 * attempt fails with "network" even though the connection is fine.
 */
export const NETWORK_RETRY_LIMIT = 2;

export type SpeechStatus = "idle" | "listening" | "done" | "error";

/**
 * Maps to messages in messages/<locale>.json → shadowing.errors.
 * BLOCKING_ERRORS can't be fixed by retrying, so the page switches to
 * "I said it" instead. unavailable = NETWORK_RETRY_LIMIT network errors in
 * a row.
 */
export type SpeechError =
  | "unsupported"
  | "brave"
  | "unavailable"
  | "permissionDenied"
  | "noMicrophone"
  | "noSpeech"
  | "network"
  | "failed";

export const BLOCKING_ERRORS: readonly SpeechError[] = [
  "unsupported",
  "brave",
  "unavailable",
  "permissionDenied",
  "noMicrophone",
];

/** Whether recognition can run here; "brave" has the API but no service. */
export type SpeechAvailability = "available" | "unsupported" | "brave";

type RecognitionCtor = new () => SpeechRecognition;

/** The browser's SpeechRecognition (standard or webkit-prefixed), if any. */
export function getSpeechRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Brave exposes SpeechRecognition but every attempt fails with "network".
 * Its user agent claims to be Chrome; navigator.brave is the documented check.
 */
export function isBrave(): boolean {
  return typeof navigator !== "undefined" && "brave" in navigator;
}

function getAvailability(): SpeechAvailability {
  if (isBrave()) return "brave";
  return getSpeechRecognition() ? "available" : "unsupported";
}

const ERROR_CODES: Record<string, SpeechError> = {
  "not-allowed": "permissionDenied",
  "service-not-allowed": "permissionDenied",
  "audio-capture": "noMicrophone",
  network: "network",
  "no-speech": "noSpeech",
};

const noop = () => () => {};

/**
 * One English (en-US) speech-recognition attempt at a time: start() listens,
 * shows interim words in `transcript`, and ends by itself after SILENCE_MS of
 * silence (or stop()), then calls onFinish with what was heard.
 */
export function useSpeechRecognition() {
  // Availability is only known in the browser; the server renders "unknown"
  // (null) so the first client render matches the server HTML.
  const availability = useSyncExternalStore<SpeechAvailability | null>(
    noop,
    getAvailability,
    () => null,
  );
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finishRef = useRef<() => void>(() => {});
  // Network errors in a row; kept across reset() since the cause is the
  // browser or connection, not the attempt.
  const networkErrorsRef = useRef(0);

  const cleanup = useCallback(() => {
    finishRef.current = () => {};
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(
    (onFinish: (heard: string) => void) => {
      cleanup();
      const Recognition = getSpeechRecognition();
      const unavailable = getAvailability();
      if (!Recognition || unavailable !== "available") {
        setError(unavailable === "brave" ? "brave" : "unsupported");
        setStatus("error");
        return;
      }

      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      let heard = "";
      let ended = false;
      let silenceTimer: number | undefined;
      const noSpeechTimer = window.setTimeout(() => {
        if (!heard) fail("noSpeech");
      }, NO_SPEECH_MS);

      function stopTimers() {
        window.clearTimeout(silenceTimer);
        window.clearTimeout(noSpeechTimer);
      }

      function finish() {
        if (ended) return;
        ended = true;
        stopTimers();
        try {
          recognition.stop();
        } catch {
          // Already stopped.
        }
        networkErrorsRef.current = 0;
        setStatus("done");
        onFinish(heard);
      }

      function fail(reason: SpeechError) {
        if (ended) return;
        ended = true;
        stopTimers();
        try {
          recognition.abort();
        } catch {
          // Already stopped.
        }
        if (reason === "network") {
          networkErrorsRef.current += 1;
          if (networkErrorsRef.current >= NETWORK_RETRY_LIMIT) {
            reason = "unavailable";
          }
        } else {
          networkErrorsRef.current = 0;
        }
        setError(reason);
        setStatus("error");
      }

      finishRef.current = () => (heard ? finish() : fail("noSpeech"));

      recognition.onresult = (event) => {
        heard = Array.from(event.results, (result) => result[0].transcript)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        setTranscript(heard);
        window.clearTimeout(silenceTimer);
        silenceTimer = window.setTimeout(finish, SILENCE_MS);
      };
      recognition.onerror = (event) => {
        if (event.error === "aborted") return;
        fail(ERROR_CODES[event.error] ?? "failed");
      };
      // The browser may end on its own (e.g. a long pause): keep what we have.
      recognition.onend = () => {
        if (heard) finish();
        else fail("noSpeech");
      };

      setTranscript("");
      setError(null);
      setStatus("listening");
      try {
        recognition.start();
      } catch {
        fail("failed");
      }
    },
    [cleanup],
  );

  /** Ends the current attempt now with what has been heard so far. */
  const stop = useCallback(() => finishRef.current(), []);

  /** Cancels any attempt and clears the transcript. */
  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setTranscript("");
    setError(null);
  }, [cleanup]);

  return { availability, status, transcript, error, start, stop, reset };
}
