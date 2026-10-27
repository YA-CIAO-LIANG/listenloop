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

export type SpeechStatus = "idle" | "listening" | "done" | "error";

/**
 * Maps to messages in messages/<locale>.json → shadowing.errors.
 * unsupported / permissionDenied / noMicrophone can't be fixed by retrying,
 * so the page switches to "I said it" instead.
 */
export type SpeechError =
  | "unsupported"
  | "permissionDenied"
  | "noMicrophone"
  | "noSpeech"
  | "network"
  | "failed";

export const BLOCKING_ERRORS: readonly SpeechError[] = [
  "unsupported",
  "permissionDenied",
  "noMicrophone",
];

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
  // Support is only known in the browser; the server renders "unknown" (null)
  // so the first client render matches the server HTML.
  const supported = useSyncExternalStore(
    noop,
    () => getSpeechRecognition() !== null,
    () => null,
  );
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finishRef = useRef<() => void>(() => {});

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
      if (!Recognition) {
        setError("unsupported");
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

  return { supported, status, transcript, error, start, stop, reset };
}
