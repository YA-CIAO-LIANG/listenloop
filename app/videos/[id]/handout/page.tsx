import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Handout } from "@/components/Handout";
import { HandoutGate } from "@/components/HandoutGate";
import { getVideo } from "@/lib/video-library";

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]/handout">): Promise<Metadata> {
  const video = getVideo((await params).id);
  const t = await getTranslations("handout");
  return video ? { title: `${video.title} · ${t("title")}` } : {};
}

export default async function HandoutPage({
  params,
}: PageProps<"/videos/[id]/handout">) {
  const video = getVideo((await params).id);
  if (!video) notFound();
  const t = await getTranslations("handout");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6 print:max-w-none print:p-0">
      <Link
        href={`/videos/${video.id}`}
        className="text-supporting text-ink-muted hover:text-ink print:hidden"
      >
        <span aria-hidden="true">← </span>
        <span lang="en">{video.title}</span>
      </Link>
      <h1 className="mt-6 font-display text-h1 print:mt-0">
        <span lang="en">{video.title}</span> · {t("title")}
      </h1>
      <div className="mt-6">
        <HandoutGate videoId={video.id}>
          <Handout video={video} />
        </HandoutGate>
      </div>
    </main>
  );
}
