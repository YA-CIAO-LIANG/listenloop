import { describe, expect, it } from "vitest";
import { keepTypedTitles, oneLineTitle, practiceTitles } from "@/lib/titles";

/** Bilingual titles (D83). */
describe("practiceTitles", () => {
  it("uses both columns when set", () => {
    expect(
      practiceTitles({
        title: "x",
        title_en: "At the Bank",
        title_zh: "在銀行",
      }),
    ).toEqual({ en: "At the Bank", zh: "在銀行" });
  });

  it("falls back to an older practice's only title", () => {
    expect(practiceTitles({ title: "At the Bank" })).toEqual({
      en: "At the Bank",
      zh: null,
    });
    expect(practiceTitles({ title: "張多啦" })).toEqual({
      en: "張多啦",
      zh: null,
    });
    expect(practiceTitles({ title: "張多啦", title_en: "Doraemon" })).toEqual({
      en: "Doraemon",
      zh: "張多啦",
    });
  });
});

describe("oneLineTitle", () => {
  it("joins English and Chinese, English first", () => {
    expect(oneLineTitle({ en: "At the Bank", zh: "在銀行" })).toBe(
      "At the Bank｜在銀行",
    );
    expect(oneLineTitle({ en: "At the Bank", zh: null })).toBe("At the Bank");
  });
});

describe("keepTypedTitles", () => {
  const written = { en: "Asking for Sick Leave", zh: "請病假" };

  it("keeps a typed Chinese title exactly and takes the written English", () => {
    expect(keepTypedTitles({ zh: "  跟教授 請病假  " }, written)).toEqual({
      en: "Asking for Sick Leave",
      zh: "跟教授 請病假",
    });
  });

  it("keeps a typed English title exactly and takes the written Chinese", () => {
    expect(keepTypedTitles({ en: "My  Sick Day! " }, written)).toEqual({
      en: "My  Sick Day!",
      zh: "請病假",
    });
  });

  it("keeps both when both are typed, whatever was written", () => {
    expect(
      keepTypedTitles({ en: "Mine", zh: "我的" }, { en: "Other", zh: "其他" }),
    ).toEqual({ en: "Mine", zh: "我的" });
  });

  it("takes both written ones when nothing was typed", () => {
    expect(keepTypedTitles({ en: "  ", zh: "" }, written)).toEqual(written);
  });
});
