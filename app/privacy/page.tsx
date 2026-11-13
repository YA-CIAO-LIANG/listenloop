import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/privacy");
}

/**
 * The privacy policy (Google sign-in and Google Play need a public one;
 * D17, D60). The text lives in the translation files (privacy.sections).
 */
export default function PrivacyPage() {
  return <LegalPage namespace="privacy" />;
}
