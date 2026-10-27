/**
 * A smooth outline through [u, value] points (u ascending, 0 = snout, 1 =
 * tail base), with every value multiplied by `scale`. Smoothstep between
 * points keeps the outline round, not faceted.
 */
export function profile(points: readonly [number, number][], scale = 1) {
  return (u: number) => {
    const clamped = Math.max(0, Math.min(1, u));
    for (let i = 1; i < points.length; i++) {
      const [u1, v1] = points[i];
      if (clamped <= u1) {
        const [u0, v0] = points[i - 1];
        const t = (clamped - u0) / (u1 - u0);
        const s = t * t * (3 - 2 * t);
        return (v0 + (v1 - v0) * s) * scale;
      }
    }
    return points[points.length - 1][1] * scale;
  };
}

/** A fin that rises straight to a peak at `peak` (0–1), then falls back. */
export function pointedFin(height: number, peak: number, fall = 1.4) {
  return (t: number) =>
    t < peak
      ? (height * t) / peak
      : height * Math.pow(Math.max(0, 1 - (t - peak) / (1 - peak)), fall);
}
