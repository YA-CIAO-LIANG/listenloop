import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("refund");
  return { title: t("title"), description: t("intro") };
}

/** The refund policy (D85); the text lives in refund.sections. */
export default function RefundPage() {
  return <LegalPage namespace="refund" />;
}
