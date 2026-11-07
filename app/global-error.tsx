"use client";

/**
 * When even the layout fails (D61): no translations or styles can be
 * relied on here, so it's a small page in both languages with inline
 * styles in the brand's colors.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf8",
          color: "#141414",
          padding: "4rem 1rem",
        }}
      >
        <main style={{ maxWidth: "36rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.75rem" }}>網站暫時出了問題</h1>
          <p lang="en" style={{ color: "#5c5c5c" }}>
            Something went wrong.
          </p>
          <p style={{ color: "#5c5c5c" }}>
            請重新整理頁面，或稍後再試。Please reload the page or try again
            later.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.25rem",
              background: "#141414",
              color: "#fafaf8",
              border: 0,
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            再試一次 · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
