import { getLibraryItems } from "@/auth/library";
import { renderShareImage, SHARE_IMAGE_SIZE } from "@/components/ShareImage";
import { isLearnCategory } from "@/lib/learn";
import en from "@/messages/en.json";

export const alt = "ListenLoop — an English listening material";
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

/**
 * A material's share image (D167): its English title, level, and topic.
 * Only the public library (official materials and built-in videos) is
 * looked up, from the same cache as the home page; anything else — a
 * learner's own or shared practice — gets the general image text, so a
 * private title never ends up in an image.
 */
export default async function MaterialImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = (await getLibraryItems()).find((i) => i.id === id);
  if (!item) {
    return renderShareImage({
      label: en.metadata.siteName,
      title: en.home.tagline,
      line: en.seo.ogLine,
    });
  }
  const label = [
    item.level ? en.video.levels[item.level] : null,
    isLearnCategory(item.category) ? en.categories.names[item.category] : null,
  ]
    .filter(Boolean)
    .join(" / ");
  return renderShareImage({
    label: label || en.metadata.siteName,
    title: item.title,
    line: en.seo.ogLine,
  });
}
