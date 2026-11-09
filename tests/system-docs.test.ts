import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  headingSlug,
  parseSystemDoc,
  parseSystemDocLanguage,
  SYSTEM_DOC_LANGUAGES,
  SYSTEM_DOCS,
  systemDocPath,
} from "@/lib/system-docs";

/**
 * The system documents: each in both languages, with the same structure
 * (headings, diagrams, tables), a table of contents whose links all work,
 * and the date they were last updated.
 */
const read = (language: (typeof SYSTEM_DOC_LANGUAGES)[number], doc: string) =>
  readFileSync(systemDocPath(language, doc as "system"), "utf8");

/** Headings outside code blocks, as [level, text]. */
function headings(source: string): [number, string][] {
  const out: [number, string][] = [];
  let inCode = false;
  for (const line of source.split("\n")) {
    if (line.startsWith("```")) inCode = !inCode;
    const match = !inCode && /^(#{1,4}) (.+)$/.exec(line);
    if (match) out.push([match[1].length, match[2].trim()]);
  }
  return out;
}

const count = (source: string, pattern: RegExp) =>
  (source.match(pattern) ?? []).length;

describe("system documents", () => {
  it.each(SYSTEM_DOCS)("%s has the same structure in both languages", (doc) => {
    const zh = read("zh-Hant", doc);
    const en = read("en", doc);
    expect(headings(en).map(([level]) => level)).toEqual(
      headings(zh).map(([level]) => level),
    );
    expect(count(en, /```mermaid/g)).toBe(count(zh, /```mermaid/g));
    // Table header separators: one per table.
    expect(count(en, /^\| *-{3,}/gm)).toBe(count(zh, /^\| *-{3,}/gm));
  });

  it.each(
    SYSTEM_DOC_LANGUAGES.flatMap((language) =>
      SYSTEM_DOCS.map((doc) => [language, doc] as const),
    ),
  )("%s %s opens with contents that link to its headings", (language, doc) => {
    const source = read(language, doc);
    const slugs = new Set(
      headings(source).map(([, text]) => headingSlug(text)),
    );
    const contents = source.slice(
      source.indexOf(language === "en" ? "## Contents" : "## 目錄"),
      source.indexOf("\n---"),
    );
    const links = [...contents.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(5);
    expect(links.filter((link) => !slugs.has(link))).toEqual([]);
  });

  it.each(
    SYSTEM_DOC_LANGUAGES.flatMap((language) =>
      SYSTEM_DOCS.map((doc) => [language, doc] as const),
    ),
  )("%s %s ends with the date it was updated", (language, doc) => {
    const last = read(language, doc).trim().split("\n").pop();
    expect(last).toMatch(
      language === "en"
        ? /^Last updated: \d{4}-\d{2}-\d{2}$/
        : /^最後更新：\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("headingSlug", () => {
  it("makes GitHub's anchors in either script", () => {
    expect(headingSlug("1. 產品概述")).toBe("1-產品概述");
    expect(headingSlug("8. 國際化、設計系統、無障礙")).toBe(
      "8-國際化設計系統無障礙",
    );
    expect(headingSlug("3. Technology choices and why")).toBe(
      "3-technology-choices-and-why",
    );
    expect(headingSlug("7. 講義與 PDF")).toBe("7-講義與-pdf");
  });
});

describe("parsing the page's address", () => {
  it("falls back to the system manual in the interface language", () => {
    expect(parseSystemDoc("admin")).toBe("admin");
    expect(parseSystemDoc("../secrets")).toBe("system");
    expect(parseSystemDocLanguage("en", "zh-Hant")).toBe("en");
    expect(parseSystemDocLanguage("fr", "en")).toBe("en");
    expect(parseSystemDocLanguage(undefined, "zh-Hant")).toBe("zh-Hant");
  });
});
