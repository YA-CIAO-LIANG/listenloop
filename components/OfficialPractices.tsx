import { getTranslations } from "next-intl/server";
import { listOfficialPractices } from "@/auth/public-practices";
import { PracticeCard } from "./PracticeCard";

/**
 * The library's first group (D46): practices admins made for everyone,
 * in the order they were made. Nothing shows until there's one.
 */
export async function OfficialPractices() {
  const practices = await listOfficialPractices();
  if (practices.length === 0) return null;
  const t = await getTranslations("library.official");
  return (
    <section aria-labelledby="collection-official" className="mt-8">
      <h3
        id="collection-official"
        className="flex flex-wrap items-baseline gap-x-3 font-display text-h3"
      >
        {t("title")}
        <span className="text-supporting font-normal text-ink-muted">
          {t("count", { count: practices.length })}
        </span>
      </h3>
      <p className="mt-1 text-supporting text-ink-muted">{t("intro")}</p>
      <ul className="mt-6 grid gap-6 split:grid-cols-2">
        {practices.map((practice) => (
          <li key={practice.id}>
            <PracticeCard practice={practice} />
          </li>
        ))}
      </ul>
    </section>
  );
}
