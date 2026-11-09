/**
 * The progress share card (D110): a square image made in the browser when
 * Day 7 is done — Day 1 and Day 7 accuracy, the change, the material's
 * title, and the site's address. Nothing personal (no name, account, or
 * date). Drawn on a canvas, so it needs no server and no AI.
 */
export const SHARE_CARD_SIZE = 1080;

/** The light theme's tokens (app/globals.css): the card is always light. */
export const SHARE_CARD_COLORS = {
  ground: "#fafaf8",
  ink: "#141414",
  muted: "#5c5c5c",
  accent: "#e8590c",
  line: "#e5e3de",
  success: "#2d784c",
} as const;

export type ShareCardText = {
  heading: string;
  day1Label: string;
  day7Label: string;
  day1: string;
  day7: string;
  change: string;
  /** Whether the change is an improvement (drawn in the success color). */
  improved: boolean;
  title: string;
  titleZh: string | null;
  site: string;
};

/** The parts of a canvas context the card uses (a stand-in in tests). */
export type CardContext = Pick<
  CanvasRenderingContext2D,
  "fillRect" | "fillText" | "measureText" | "beginPath" | "arc" | "fill"
> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

const SANS =
  '"Instrument Sans", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

/** Splits text into lines no wider than `width`, at spaces or characters. */
export function wrapText(
  ctx: Pick<CardContext, "measureText">,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  // Words for English; single characters where there are no spaces (Chinese).
  const pieces = text.includes(" ") ? text.split(" ") : [...text];
  const joiner = text.includes(" ") ? " " : "";
  const lines: string[] = [];
  let line = "";
  for (const piece of pieces) {
    const candidate = line ? `${line}${joiner}${piece}` : piece;
    if (ctx.measureText(candidate).width <= width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = piece;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/.$/u, "")}…`;
    return kept;
  }
  return lines;
}

/** Draws the card on a SHARE_CARD_SIZE square. */
export function drawShareCard(ctx: CardContext, text: ShareCardText): void {
  const size = SHARE_CARD_SIZE;
  const pad = 96;
  const c = SHARE_CARD_COLORS;
  ctx.fillStyle = c.ground;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, 0, size, 16);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Brand: the dot and the name.
  ctx.fillStyle = c.accent;
  ctx.beginPath();
  ctx.arc(pad + 14, pad + 26, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.ink;
  ctx.font = `600 40px ${SANS}`;
  ctx.fillText("ListenLoop", pad + 44, pad + 40);

  ctx.fillStyle = c.muted;
  ctx.font = `400 40px ${SANS}`;
  ctx.fillText(text.heading, pad, pad + 150);

  // Day 1 → Day 7.
  ctx.font = `500 32px ${SANS}`;
  ctx.fillText(text.day1Label, pad, pad + 260);
  ctx.fillText(text.day7Label, size / 2 + 40, pad + 260);
  ctx.font = `600 150px ${SANS}`;
  ctx.fillStyle = c.muted;
  ctx.fillText(text.day1, pad, pad + 410);
  ctx.fillStyle = c.ink;
  ctx.fillText(text.day7, size / 2 + 40, pad + 410);
  ctx.fillStyle = c.accent;
  ctx.font = `600 80px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText("→", size / 2 - 10, pad + 385);
  ctx.textAlign = "left";

  ctx.fillStyle = text.improved ? c.success : c.muted;
  ctx.font = `600 52px ${SANS}`;
  ctx.fillText(text.change, pad, pad + 500);

  // The material.
  ctx.fillStyle = c.line;
  ctx.fillRect(pad, pad + 560, size - pad * 2, 3);
  ctx.fillStyle = c.ink;
  ctx.font = `600 46px ${SANS}`;
  let y = pad + 640;
  for (const line of wrapText(ctx, text.title, size - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += 58;
  }
  if (text.titleZh) {
    ctx.fillStyle = c.muted;
    ctx.font = `400 40px ${SANS}`;
    for (const line of wrapText(ctx, text.titleZh, size - pad * 2, 1)) {
      ctx.fillText(line, pad, y + 4);
      y += 52;
    }
  }

  ctx.fillStyle = c.muted;
  ctx.font = `400 32px ${SANS}`;
  ctx.fillText(text.site, pad, size - pad + 10);
}
