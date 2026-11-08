import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  themeAttribute,
  themeInitScript,
} from "@/lib/theme";

describe("parseThemePreference", () => {
  it.each(["system", "light", "dark"])("accepts %s", (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  it.each([null, undefined, "", "Dark", "blue", 1])(
    "falls back to system for %j",
    (value) => {
      expect(parseThemePreference(value)).toBe("system");
    },
  );
});

describe("themeAttribute", () => {
  it("returns null for system so the media query decides", () => {
    expect(themeAttribute("system")).toBeNull();
  });

  it("returns the explicit theme", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
  });
});

describe("themeInitScript", () => {
  function run(
    stored: string | null,
    { throws = false, accent = null as string | null } = {},
  ) {
    const attributes: Record<string, string> = {};
    const localStorage = {
      getItem: (key: string) => {
        if (throws) throw new Error("blocked");
        if (key === "ll-accent") return accent;
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    };
    const document = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    };
    new Function("localStorage", "document", themeInitScript)(
      localStorage,
      document,
    );
    return attributes;
  }

  it("applies a saved light or dark theme", () => {
    expect(run("dark")).toEqual({ "data-theme": "dark" });
    expect(run("light")).toEqual({ "data-theme": "light" });
  });

  it("leaves the attribute unset for system or invalid values", () => {
    expect(run("system")).toEqual({});
    expect(run(null)).toEqual({});
    expect(run("<script>")).toEqual({});
  });

  it("applies a saved accent color, but only a known one (D93)", () => {
    expect(run(null, { accent: "teal" })).toEqual({ "data-accent": "teal" });
    expect(run("dark", { accent: "gold" })).toEqual({
      "data-theme": "dark",
      "data-accent": "gold",
    });
    expect(run(null, { accent: "orange" })).toEqual({});
    expect(run(null, { accent: '"><script>' })).toEqual({});
  });

  it("does not throw when storage is unavailable", () => {
    expect(() => run(null, { throws: true })).not.toThrow();
  });
});
