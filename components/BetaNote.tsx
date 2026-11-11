import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * "ListenLoop is in Beta" with a way to send feedback (D132), on the home
 * and sign-in pages.
 */
export async function BetaNote({ className = "" }: { className?: string }) {
  const t = await getTranslations("beta.note");
  return (
    <p
      className={`max-w-reading rounded-base border border-line bg-band px-4 py-3 text-supporting ${className}`}
    >
      <span className="font-medium">{t("label")}</span> {t("body")}{" "}
      <Link
        href="/feedback"
        className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
      >
        {t("feedback")}
      </Link>
    </p>
  );
}
