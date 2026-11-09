"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  drawShareCard,
  SHARE_CARD_SIZE,
  type ShareCardText,
} from "@/lib/share-card";
import { SITE_URL } from "@/lib/site";
import { Button, buttonClassName } from "./Button";

const FILE_NAME = "listenloop-progress.png";

/**
 * The Day 7 share card (D110): drawn in the browser as a PNG, shown as a
 * preview, and offered to download or to share (the system share sheet,
 * where the browser supports sharing files). It shows only the scores, the
 * material's title, and the site's address.
 */
export function ShareCard({
  text,
}: {
  text: Omit<ShareCardText, "site" | "heading" | "day1Label" | "day7Label">;
}) {
  const t = useTranslations("shareCard");
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const card: ShareCardText = {
    ...text,
    heading: t("heading"),
    day1Label: t("day1"),
    day7Label: t("day7"),
    site: SITE_URL.replace(/^https?:\/\//, ""),
  };
  const key = JSON.stringify(card);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_CARD_SIZE;
    canvas.height = SHARE_CARD_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawShareCard(ctx, JSON.parse(key) as ShareCardText);
    let url: string | null = null;
    let cancelled = false;
    canvas.toBlob((blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      setImage({ url, blob });
    }, "image/png");
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  const file = image
    ? new File([image.blob], FILE_NAME, { type: "image/png" })
    : null;
  const canShareFile =
    file !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      if (canShareFile) {
        await navigator.share({
          files: [file],
          text: t("shareText"),
          url: SITE_URL,
        });
      } else {
        await navigator.clipboard.writeText(`${t("shareText")} ${SITE_URL}`);
        setStatus("copied");
      }
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if ((error as Error)?.name !== "AbortError") setStatus("failed");
    }
  }

  return (
    <section aria-labelledby="share-card" className="space-y-4">
      <h3 id="share-card" className="font-display text-h3">
        {t("title")}
      </h3>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("intro")}
      </p>
      {image ? (
        // A blob: URL made here; next/image can't optimize it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={t("alt", {
            day1: text.day1,
            day7: text.day7,
            title: text.title,
          })}
          width={SHARE_CARD_SIZE}
          height={SHARE_CARD_SIZE}
          className="h-auto w-full max-w-sm rounded-base border border-line"
        />
      ) : (
        <div
          aria-hidden="true"
          className="aspect-square w-full max-w-sm rounded-base border border-line bg-surface"
        />
      )}
      <div className="flex flex-wrap gap-3">
        <a
          href={image?.url}
          download={FILE_NAME}
          aria-disabled={!image}
          className={buttonClassName({
            variant: "primary",
            size: "md",
            className: image ? undefined : "pointer-events-none opacity-50",
            as: "link",
          })}
        >
          {t("download")}
        </a>
        <Button variant="secondary" disabled={!image} onClick={share}>
          {canShareFile ? t("share") : t("copyLink")}
        </Button>
      </div>
      {status !== "idle" && (
        <p role="status" className="text-supporting text-ink-muted">
          {t(status)}
        </p>
      )}
    </section>
  );
}
