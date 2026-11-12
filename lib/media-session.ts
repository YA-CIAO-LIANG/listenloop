/**
 * The phone's lock screen and the browser's media controls (D135), for
 * audio materials: the title and play, pause, previous, next. Does
 * nothing where the Media Session API isn't there. Returns a clean-up.
 */
export type MediaControls = {
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
};

const ACTIONS = ["play", "pause", "previoustrack", "nexttrack"] as const;

export function setUpMediaSession(
  session: MediaSession | undefined,
  info: { title: string; artist: string; artwork: string },
  controls: MediaControls,
): () => void {
  if (!session) return () => {};
  try {
    if (typeof MediaMetadata !== "undefined") {
      session.metadata = new MediaMetadata({
        title: info.title,
        artist: info.artist,
        artwork: [{ src: info.artwork, sizes: "512x512", type: "image/png" }],
      });
    }
  } catch {
    // Some browsers refuse artwork; the controls still work.
  }
  const handlers: Record<(typeof ACTIONS)[number], () => void> = {
    play: controls.play,
    pause: controls.pause,
    previoustrack: controls.previous,
    nexttrack: controls.next,
  };
  for (const action of ACTIONS) {
    try {
      session.setActionHandler(action, handlers[action]);
    } catch {
      // An action this browser doesn't support.
    }
  }
  return () => {
    for (const action of ACTIONS) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // Not supported: nothing to clear.
      }
    }
    session.metadata = null;
  };
}

/** Tells the lock screen whether it's playing. */
export function setMediaPlaying(
  session: MediaSession | undefined,
  playing: boolean,
) {
  if (session) session.playbackState = playing ? "playing" : "paused";
}
