import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/refund");
}

/** The refund policy (D85); the text lives in refund.sections. */
export default function RefundPage() {
  return <LegalPage namespace="refund" />;
}
