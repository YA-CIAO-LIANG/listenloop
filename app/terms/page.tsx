import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/terms");
}

/**
 * The terms of service (D60), public for Google sign-in and Google Play.
 * The text lives in the translation files (terms.sections).
 */
export default function TermsPage() {
  return <LegalPage namespace="terms" />;
}
