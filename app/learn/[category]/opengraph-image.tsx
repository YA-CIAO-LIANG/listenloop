import { renderShareImage, SHARE_IMAGE_SIZE } from "@/components/ShareImage";
import { isLearnCategory } from "@/lib/learn";
import en from "@/messages/en.json";

export const alt = "ListenLoop — English listening practice by topic";
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

/**
 * A topic page's share image (D167), in English: the image font has no
 * Chinese, so the topic's English name from the message file. Made on
 * request, not at build time: prerendering it also starts rendering the
 * topic page, whose library read would then be cached from the build
 * environment (no database there).
 */
export default async function TopicImage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const name = isLearnCategory(category)
    ? en.categories.names[category]
    : en.learn.indexTitle;
  return renderShareImage({
    label: en.learn.indexTitle,
    title: en.learn.pageTitle.replace("{name}", name),
    line: en.learn.howTitle,
  });
}
