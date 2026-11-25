import { describe, expect, it } from "vitest";
import {
  bundleSaving,
  chatSessions,
  listeningOffer,
  perDay,
  pricePerMonth,
  proUnitSaving,
  shortTexts,
  studentDiscount,
} from "@/lib/pricing-display";

/** The numbers beside each price on the pricing page (D210). */
describe("pricing page numbers (D210)", () => {
  it("says what all-in-one saves a month against buying both", () => {
    expect(bundleSaving("plus", "month")).toBe(149 + 149 - 269);
    expect(bundleSaving("student", "month")).toBe(90 + 119 - 189);
    expect(bundleSaving("pro", "month")).toBe(299 + 249 - 499);
    // Yearly: each yearly price ÷ 12, rounded.
    expect(pricePerMonth("all", "plus", "year")).toBe(224);
    expect(bundleSaving("plus", "year")).toBe(124 + 124 - 224);
  });

  it("says how much cheaper the student tier is than Plus", () => {
    expect(Math.round(studentDiscount("listening") * 100)).toBe(40);
    expect(Math.round(studentDiscount("writing") * 100)).toBe(20);
    expect(Math.round(studentDiscount("all") * 100)).toBe(30);
  });

  it("says Pro's smallest per-unit saving against Plus", () => {
    expect(Math.round(proUnitSaving("listening") * 100)).toBe(33);
    expect(proUnitSaving("writing")).toBeGreaterThan(0.3);
    expect(Math.round(proUnitSaving("all") * 100)).toBe(30);
  });

  it("turns allowances into things people picture", () => {
    expect(shortTexts(3_000)).toBe(20);
    expect(shortTexts(2_400)).toBe(16);
    expect(chatSessions(135)).toBe(6);
    expect(perDay(21)).toBe(3);
    expect(perDay(19)).toBe(2.7);
  });

  it("offers the next plan for listening, all-in-one to the writing line", () => {
    expect(listeningOffer("free")).toEqual({
      line: "listening",
      tier: "plus",
      upsell: false,
    });
    expect(listeningOffer("writing-student")).toEqual({
      line: "all",
      tier: "student",
      upsell: true,
    });
    expect(listeningOffer("paid")).toEqual({
      line: "all",
      tier: "pro",
      upsell: false,
    });
    expect(listeningOffer("listening-pro")).toBeNull();
    expect(listeningOffer("admin")).toBeNull();
  });
});
