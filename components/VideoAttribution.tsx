import { useTranslations } from "next-intl";
import type { Attribution } from "@/lib/videos";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * Credit for the video, shown on every page that plays it. CC BY requires
 * the credit, a link to the license, and a note of what was changed.
 */
export function VideoAttribution({
  attribution,
  className = "",
}: {
  attribution: Attribution;
  className?: string;
}) {
  const t = useTranslations("video.attribution");

  return (
    <section className={`text-supporting text-ink-muted ${className}`}>
      <h2 className="mb-2 text-metadata tracking-widest uppercase">
        {t("heading")}
      </h2>
      <p lang="en" className="text-ink">
        {attribution.credit}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>{t("license")}</dt>
        <dd>
          <a
            href={attribution.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {attribution.license}
          </a>
          {" · "}
          <a
            href={attribution.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {t("licenseTerms")}
          </a>
        </dd>
        <dt>{t("transcript")}</dt>
        <dd className="break-all">
          <a
            href={attribution.transcriptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {new URL(attribution.transcriptUrl).hostname}
          </a>
        </dd>
        <dt>{t("changes")}</dt>
        <dd lang="en">{attribution.changes}</dd>
      </dl>
    </section>
  );
}
