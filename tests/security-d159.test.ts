import { describe, expect, it } from "vitest";
import {
  RECENT_SIGN_IN_SECONDS,
  signedInAt,
  signedInRecently,
} from "@/lib/auth/recent";
import { looksLikeText } from "@/lib/custom-practice/text-guard";
import { looksLikeMp3 } from "@/lib/upload-audio";

/** Account and input safety (D159). */
describe("recent sign-in for risky admin actions", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const seconds = now.getTime() / 1000;

  it("reads the latest sign-in time from the token's amr", () => {
    expect(
      signedInAt({
        amr: [
          { method: "password", timestamp: 100 },
          { method: "oauth", timestamp: 200 },
        ],
      }),
    ).toBe(200);
    expect(signedInAt({})).toBeNull();
    expect(signedInAt({ amr: "nope" })).toBeNull();
    expect(signedInAt(null)).toBeNull();
  });

  it("allows 30 minutes, not more", () => {
    expect(signedInRecently(seconds - 60, now)).toBe(true);
    expect(signedInRecently(seconds - RECENT_SIGN_IN_SECONDS, now)).toBe(true);
    expect(signedInRecently(seconds - RECENT_SIGN_IN_SECONDS - 1, now)).toBe(
      false,
    );
    expect(signedInRecently(null, now)).toBe(false);
    // A clock far ahead isn't trusted.
    expect(signedInRecently(seconds + 3600, now)).toBe(false);
  });
});

describe("the real type of an uploaded file", () => {
  it("knows an MP3 by its first bytes", () => {
    expect(looksLikeMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04]))).toBe(true);
    expect(looksLikeMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe(true);
    expect(looksLikeMp3(new Uint8Array([0xff, 0xf3, 0x48, 0xc4]))).toBe(true);
  });

  it("refuses anything else, whatever its name says", () => {
    for (const bytes of [
      [0x3c, 0x68, 0x74, 0x6d], // <htm
      [0x4d, 0x5a, 0x90, 0x00], // a Windows program
      [0x25, 0x50, 0x44, 0x46], // %PDF
      [0xff, 0xf9, 0x90, 0x64], // reserved layer
      [0xff, 0xfb, 0xf0, 0x64], // bad bit rate
      [0xff, 0xfb],
    ]) {
      expect(looksLikeMp3(new Uint8Array(bytes))).toBe(false);
    }
  });
});

describe("text that's really text", () => {
  it("accepts ordinary English and Chinese", () => {
    expect(looksLikeText("Hello.\nA: Hi!\tB: Bye.")).toBe(true);
    expect(looksLikeText("今天天氣很好。")).toBe(true);
    expect(looksLikeText("")).toBe(true);
  });

  it("refuses binary files and control characters", () => {
    expect(looksLikeText("ab\u0000cd")).toBe(false);
    expect(looksLikeText("x\u0007".repeat(20))).toBe(false);
    expect(looksLikeText("���abc")).toBe(false);
  });
});
