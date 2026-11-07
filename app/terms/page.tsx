import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("title"), description: t("intro") };
}

/**
 * The terms of service (D60), public for Google sign-in and Google Play.
 * The text lives in the translation files (terms.sections).
 */
export default function TermsPage() {
  return <LegalPage namespace="terms" />;
}
