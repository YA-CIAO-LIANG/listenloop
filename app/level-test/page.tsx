import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { levelTestSources } from "@/auth/level-test";
import { LevelTest } from "@/components/LevelTest";
import { pickLevelTest } from "@/lib/level-test";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/level-test");
}

/**
 * The level test (D109): a short dictation at three levels, open to
 * everyone, then a recommended level and first material.
 */
export default async function LevelTestPage() {
  const [t, sources] = await Promise.all([
    getTranslations("levelTest"),
    levelTestSources(),
  ]);
  const sentences = pickLevelTest(sources);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <LevelTest sentences={sentences} sources={sources} />
      </div>
    </main>
  );
}
