import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOG_POSTS, blogFile } from "@/lib/blog";
import { hasFullWidth } from "@/lib/content-fixes";
import { isLearnCategory } from "@/lib/learn";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

describe("articles (D122)", () => {
  it("has five articles with unique slugs, each with its text", () => {
    expect(BLOG_POSTS.length).toBeGreaterThanOrEqual(5);
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const post of BLOG_POSTS) {
      expect(existsSync(blogFile(post.slug)), post.slug).toBe(true);
      expect(post.slug).toMatch(/^[a-z0-9-]+$/);
      expect(post.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // A search result shows about this much.
      expect([...post.description].length).toBeGreaterThanOrEqual(50);
      expect([...post.description].length).toBeLessThanOrEqual(160);
      expect(post.topics.length).toBeGreaterThan(0);
      for (const topic of post.topics)
        expect(isLearnCategory(topic)).toBe(true);
    }
  });

  for (const post of BLOG_POSTS) {
    it(`${post.slug}: links go to real pages, and digits are half-width`, () => {
      const text = readFileSync(blogFile(post.slug), "utf8");
      // The title is the page's h1; the text starts below it.
      expect(text).not.toMatch(/^# /m);
      expect(hasFullWidth(text), "full-width letters or digits (D117)").toBe(
        false,
      );
      const links = [...text.matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1]);
      expect(links.length, "links to practice").toBeGreaterThan(0);
      expect(links.some((l) => l.startsWith("/videos/p-"))).toBe(true);
      for (const link of links) {
        const blog = /^\/blog\/([a-z0-9-]+)$/.exec(link);
        const learn = /^\/learn\/([a-z-]+)$/.exec(link);
        const ok =
          link === "/level-test" ||
          // Exam English (D215).
          link === "/exams" ||
          new RegExp(`^/videos/p-${UUID}$`).test(link) ||
          (blog !== null && BLOG_POSTS.some((p) => p.slug === blog[1])) ||
          (learn !== null && isLearnCategory(learn[1]));
        expect(ok, link).toBe(true);
      }
    });
  }
});
