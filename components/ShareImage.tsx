import { ImageResponse } from "next/og";
import { ogText } from "@/lib/seo";

/** Open Graph and Twitter's large card size. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * A page's share image (D167): the wordmark, a small label, the page's
 * title, and one line under it, in the brand's colors like the site's
 * own image (app/opengraph-image.tsx). The built-in font has no Chinese,
 * so every text goes through ogText (English only); no pictures, so the
 * PNG stays small.
 */
export function renderShareImage({
  label,
  title,
  line,
}: {
  label: string;
  title: string;
  line: string;
}) {
  const heading = ogText(title, 80);
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
        <div
          style={{
            fontSize: 28,
            color: "#e8590c",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {ogText(label, 60)}
        </div>
        <div
          style={{
            fontSize: heading.length > 40 ? 60 : 76,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {heading}
        </div>
        <div style={{ fontSize: 32, color: "#5c5c5c" }}>{ogText(line, 90)}</div>
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
    SHARE_IMAGE_SIZE,
  );
}
