import { describe, expect, it } from "vitest";
import { readSupabaseConfig } from "@/lib/supabase/config";

describe("readSupabaseConfig", () => {
  it("reads an https project URL and a publishable key", () => {
    expect(
      readSupabaseConfig(" https://abc.supabase.co/ ", " sb_publishable_x "),
    ).toEqual({
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_x",
    });
  });

  it.each([
    [undefined, "key"],
    ["https://abc.supabase.co", undefined],
    ["", "key"],
    ["https://abc.supabase.co", "  "],
    ["not a url", "key"],
    ["http://abc.supabase.co", "key"],
  ])("turns accounts off for url %j and key %j", (url, key) => {
    expect(readSupabaseConfig(url, key)).toBeNull();
  });
});
