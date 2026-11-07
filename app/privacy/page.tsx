import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title"), description: t("intro") };
}

/**
 * The privacy policy (Google sign-in and Google Play need a public one;
 * D17, D60). The text lives in the translation files (privacy.sections).
 */
export default function PrivacyPage() {
  return <LegalPage namespace="privacy" />;
}
