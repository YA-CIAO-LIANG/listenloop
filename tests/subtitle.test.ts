import { describe, expect, it } from "vitest";
import {
  cleanSubtitle,
  describeInput,
  DESCRIBE_TEXT_CHARS,
  subtitleFromModel,
} from "@/lib/custom-practice/subtitle";

describe("describeInput", () => {
  it("takes whole sentences up to the limit", () => {
    const long = "a".repeat(400);
    const input = describeInput("T", [long, long, "short"]);
    expect(input).toEqual({ title: "T", text: long });
    expect(input.text.length).toBeLessThanOrEqual(DESCRIBE_TEXT_CHARS);
  });

  it("cuts a single overlong sentence", () => {
    expect(describeInput("T", ["b".repeat(900)]).text).toHaveLength(
      DESCRIBE_TEXT_CHARS,
    );
  });
});

describe("cleanSubtitle", () => {
  it("tidies spaces and wrapping quotes", () => {
    expect(cleanSubtitle("  「在機場  報到的對話」 ")).toBe(
      "在機場 報到的對話",
    );
  });

  it("refuses empty, too long, or not text", () => {
    expect(cleanSubtitle("   ")).toBeNull();
    expect(cleanSubtitle("長".repeat(61))).toBeNull();
    expect(cleanSubtitle(3)).toBeNull();
  });

  it("reads the model's answer", () => {
    expect(subtitleFromModel({ subtitle: "學生和顧問討論選課。" })).toBe(
      "學生和顧問討論選課。",
    );
    expect(subtitleFromModel({ title: "x" })).toBeNull();
    expect(subtitleFromModel(null)).toBeNull();
  });
});
