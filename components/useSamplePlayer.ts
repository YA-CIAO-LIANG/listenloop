"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One player for a set of sample clips (the voice choices), so only one
 * plays at a time: `toggle(id)` plays that clip, or stops it if it's the
 * one playing; `playing` is its id, or null.
 */
export function useSamplePlayer(sampleUrl: (id: string) => string | null) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    const stopped = () => setPlaying(null);
    audio.addEventListener("ended", stopped);
    audio.addEventListener("error", stopped);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener("ended", stopped);
      audio.removeEventListener("error", stopped);
      audioRef.current = null;
    };
  }, []);

  function toggle(id: string) {
    const audio = audioRef.current;
    const url = sampleUrl(id);
    if (!audio || !url) return;
    if (playing === id) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = url;
    audio.currentTime = 0;
    setPlaying(id);
    audio.play().catch(() => setPlaying(null));
  }

  return { playing, toggle };
}
