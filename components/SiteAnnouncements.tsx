import { getLocale } from "next-intl/server";
import { getActiveAnnouncements } from "@/auth/site-switches";
import { SiteAnnouncementBanner } from "./SiteAnnouncementBanner";

/** The newest active site announcement (D155), on every page. */
export async function SiteAnnouncements() {
  const [announcement] = await getActiveAnnouncements();
  if (!announcement) return null;
  const locale = await getLocale();
  return (
    <SiteAnnouncementBanner
      id={announcement.id}
      level={announcement.level}
      body={locale === "en" ? announcement.bodyEn : announcement.bodyZh}
    />
  );
}
