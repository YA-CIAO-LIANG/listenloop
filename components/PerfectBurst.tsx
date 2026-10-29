import type { CSSProperties } from "react";

/** Where each piece flies (px from the bottom middle), its turn, and color. */
const PIECES: readonly {
  dx: number;
  dy: number;
  turn: number;
  color: string;
}[] = [
  { dx: -150, dy: -46, turn: 220, color: "bg-accent" },
  { dx: -120, dy: -70, turn: -160, color: "bg-ink" },
  { dx: -96, dy: -30, turn: 300, color: "bg-success" },
  { dx: -70, dy: -78, turn: -240, color: "bg-accent" },
  { dx: -44, dy: -54, turn: 180, color: "bg-ink" },
  { dx: -20, dy: -84, turn: -320, color: "bg-accent" },
  { dx: 0, dy: -62, turn: 260, color: "bg-success" },
  { dx: 22, dy: -86, turn: -200, color: "bg-accent" },
  { dx: 46, dy: -50, turn: 340, color: "bg-ink" },
  { dx: 72, dy: -76, turn: -280, color: "bg-accent" },
  { dx: 98, dy: -34, turn: 200, color: "bg-success" },
  { dx: 122, dy: -66, turn: -180, color: "bg-ink" },
  { dx: 148, dy: -42, turn: 240, color: "bg-accent" },
  { dx: -132, dy: -20, turn: -300, color: "bg-accent" },
];

/**
 * A one-second burst of brand-colored confetti for a 100% dictation
 * sentence. It fills its (relative) parent and is clipped to it, so it
 * never covers the YouTube player; it ignores the pointer and screen
 * readers, so "next" and Enter work as usual. Reduced motion shows a
 * static "Perfect!" instead (see DictationSession).
 */
export function PerfectBurst() {
  return (
    <span
      aria-hidden="true"
      data-perfect-burst
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`absolute bottom-0 left-1/2 h-2.5 w-1.5 animate-confetti ${piece.color}`}
          style={
            {
              "--dx": `${piece.dx}px`,
              "--dy": `${piece.dy}px`,
              "--turn": `${piece.turn}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
