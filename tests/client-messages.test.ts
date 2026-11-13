import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import zh from "@/messages/zh-Hant.json";
import {
  AREA_NAMESPACES,
  clientMessages,
  SERVER_ONLY_NAMESPACES,
} from "@/lib/i18n/client-messages";

/** Every Client Component file (marked "use client"). */
const clientFiles = execSync("git ls-files components app", {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ f, s: readFileSync(f, "utf8") }))
  .filter(({ s }) => /^\s*["']use client["']/.test(s));

const uses = (source: string, namespace: string) =>
  new RegExp(
    `Translations\\(\\s*["'\`]${namespace}["'.]|\\bt\\w*\\(\\s*["'\`]${namespace}\\.`,
  ).test(source);

describe("messages sent to the browser (D120)", () => {
  it("no Client Component uses a server-only namespace", () => {
    for (const namespace of SERVER_ONLY_NAMESPACES) {
      expect(namespace in zh, namespace).toBe(true);
      const users = clientFiles.filter(({ s }) => uses(s, namespace));
      expect(
        users.map(({ f }) => f),
        namespace,
      ).toEqual([]);
    }
  });

  it("an area's namespaces are used only by its own pages' components", () => {
    const allowed: Record<string, RegExp> = {
      admin:
        /^(app\/admin\/|components\/(AdminNav|ClassroomSeatsControl|ContentFixActions|FeedbackStatusButton|ForecastCalculator|MaterialControls|RevenueControls|SentenceReportActions|SiteActivityChart|UserControls|ConnectionTest|UsageSettingsForm|OfficialNotesUpgrade|BetaAdmin|OpsAdmin)\.tsx$)/,
      materials:
        /^(app\/materials\/|components\/(CreatePracticeForm|EditPracticeForm|GenerateTextPanel|YouTubeCreate|UploadCreate)\.tsx$)/,
      classroom: /^(app\/classroom\/|components\/ClassroomForms\.tsx$)/,
      styleguide: /^app\/styleguide\//,
    };
    for (const [area, namespaces] of Object.entries(AREA_NAMESPACES)) {
      for (const namespace of namespaces) {
        const users = clientFiles.filter(({ s }) => uses(s, namespace));
        for (const { f } of users)
          expect(f, `${namespace} in ${f}`).toMatch(allowed[area]);
      }
    }
  });

  it("keeps everything else, and adds an area's namespaces in that area", () => {
    const everywhere = clientMessages(zh);
    expect(Object.keys(everywhere)).toContain("common");
    expect(everywhere).not.toHaveProperty("terms");
    expect(everywhere).not.toHaveProperty("admin");
    const admin = clientMessages(zh, "admin");
    expect(admin).toHaveProperty("admin");
    expect(admin).not.toHaveProperty("styleguide");
  });
});
