import { describe, expect, it } from "vitest";
import {
  drawShareCard,
  wrapText,
  type CardContext,
  type ShareCardText,
} from "@/lib/share-card";

/** The progress share card (D110), drawn on a stand-in canvas. */
function fakeContext() {
  const texts: string[] = [];
  const ctx = {
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    // 20 px per character.
    measureText: (text: string) => ({ width: [...text].length * 20 }),
    fillText: (text: string) => {
      texts.push(text);
    },
  } as unknown as CardContext;
  return { ctx, texts };
}

const card: ShareCardText = {
  heading: "我的 7 天英文聽力進步",
  day1Label: "第 1 天",
  day7Label: "第 7 天",
  day1: "62%",
  day7: "88%",
  change: "進步 26 個百分點",
  improved: true,
  title: "Ordering Coffee at a Busy Café",
  titleZh: "在忙碌的咖啡店點餐",
  site: "listenloop-three.vercel.app",
};

describe("the share card", () => {
  it("has the scores, the change, the titles, and the site", () => {
    const { ctx, texts } = fakeContext();
    drawShareCard(ctx, card);
    for (const part of [
      "ListenLoop",
      card.heading,
      "62%",
      "88%",
      card.change,
      card.titleZh,
      card.site,
    ]) {
      expect(texts).toContain(part);
    }
    expect(texts.join(" ")).toContain("Ordering Coffee");
  });

  it("wraps long titles and cuts them at the last line", () => {
    const { ctx } = fakeContext();
    expect(wrapText(ctx, "one two three four", 200, 3)).toEqual([
      "one two",
      "three four",
    ]);
    const cut = wrapText(ctx, "aaaa bbbb cccc dddd eeee", 100, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith("…")).toBe(true);
    // Chinese has no spaces: it wraps between characters.
    expect(wrapText(ctx, "在忙碌的咖啡店點餐", 100, 3)).toEqual([
      "在忙碌的咖",
      "啡店點餐",
    ]);
  });
});
