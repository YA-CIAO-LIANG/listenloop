import { ImageResponse } from "next/og";

export const alt = "ListenLoop — a seven-day English listening loop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share image (D61): the wordmark and the loop on the brand's ground,
 * black, and orange. English only, since the built-in image font has no
 * Chinese; every page shares it.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#fafaf8",
        color: "#141414",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: "#e8590c",
          }}
        />
        <div style={{ fontSize: 40, fontWeight: 600 }}>ListenLoop</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
          Hear every word.
        </div>
        <div style={{ fontSize: 36, color: "#5c5c5c" }}>
          Dictation · Shadowing · Dictation again — one recording, seven days.
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <div
            key={day}
            style={{
              width: 120,
              height: 14,
              borderRadius: 7,
              background: day === 1 || day === 7 ? "#e8590c" : "#141414",
            }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}
