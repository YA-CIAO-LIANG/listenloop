declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_URL = "https://www.youtube.com/iframe_api";

let pending: Promise<typeof YT> | null = null;

/**
 * Loads the YouTube IFrame Player API once per page. Rejects if the script
 * fails or takes too long (offline, or blocked by an ad blocker), and allows
 * a later retry.
 */
export function loadYouTubeApi(timeoutMs = 15_000): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<typeof YT>((resolve, reject) => {
    const fail = (reason: string) => {
      pending = null;
      reject(new Error(reason));
    };
    const timer = window.setTimeout(
      () => fail("YouTube API timed out"),
      timeoutMs,
    );

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else fail("YouTube API missing after load");
    };

    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      fail("YouTube API failed to load");
    };
    document.head.appendChild(script);
  });
  return pending;
}

/** Test-only: forget a cached load between tests. */
export function resetYouTubeApiForTests() {
  pending = null;
}
