import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/Button";
import { Card } from "@/components/Card";
import { CardLink } from "@/components/CardLink";
import { Divider } from "@/components/Divider";
import { FeedIcon, LockIcon, PointsIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ProgressBar } from "@/components/ProgressBar";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DayTrackerDemo,
  ProgressBarDemo,
  SentenceRowDemo,
} from "./InteractiveDemos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styleguide");
  // Living design doc: keep it out of search results and navigation.
  return { title: t("title"), robots: { index: false, follow: false } };
}

const colorTokens = [
  "ground",
  "surface",
  "band",
  "ink",
  "ink-muted",
  "accent",
  "accent-ink",
  "line",
  "success",
  "error",
  "focus",
] as const;

const typeScale = [
  { token: "hero", className: "font-display text-hero" },
  { token: "h1", className: "font-display text-h1" },
  { token: "h2", className: "font-display text-h2" },
  { token: "h3", className: "font-display text-h3" },
  { token: "body", className: "text-body" },
  { token: "supporting", className: "text-supporting" },
  { token: "metadata", className: "text-metadata tracking-widest uppercase" },
] as const;

const buttonVariants: ButtonVariant[] = ["primary", "secondary", "ghost"];

// Sample practice content (not UI copy).
const sampleSentence = "It took a while to settle in.";
const sampleVideo = {
  meta: "BEGINNER · DAILY",
  title: "How Coffee Changed the World",
  source: "VOA Learning English",
};

export default function StyleguidePage() {
  const t = useTranslations("styleguide");
  const tTheme = useTranslations("settings.theme");
  const tProgress = useTranslations("practice.progress");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <h1 className="font-display text-hero">{t("title")}</h1>
      <p className="mt-6 max-w-reading text-ink-muted">{t("intro")}</p>

      <Section title={t("sections.colors")}>
        <div className="grid gap-6 split:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <div
              key={theme}
              data-theme={theme}
              className="rounded-base border border-line bg-ground p-6 text-ink"
            >
              <p className="mb-4 text-metadata tracking-widest text-ink-muted uppercase">
                {tTheme(theme)}
              </p>
              <ul className="grid grid-cols-2 gap-4">
                {colorTokens.map((token) => (
                  <li key={token} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="size-8 shrink-0 rounded-base border border-line"
                      style={{ background: `var(--ll-${token})` }}
                    />
                    <code className="text-metadata">--ll-{token}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("sections.typography")}>
        <dl className="space-y-6">
          {typeScale.map(({ token, className }) => (
            <div key={token} className="grid gap-2 split:grid-cols-[8rem_1fr]">
              <dt>
                <code className="text-metadata text-ink-muted">{token}</code>
              </dt>
              <dd className={className}>
                {token === "body" || token === "supporting"
                  ? t("specimen.body")
                  : t("specimen.display")}
              </dd>
            </div>
          ))}
          <div className="grid gap-2 split:grid-cols-[8rem_1fr]">
            <dt>
              <code className="text-metadata text-ink-muted">sentence</code>
            </dt>
            <dd lang="en" className="text-sentence">
              {sampleSentence}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title={t("sections.buttons")}>
        <div className="space-y-6">
          {buttonVariants.map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-4">
              <code className="w-24 text-metadata text-ink-muted">
                {t(`buttons.${variant}`)}
              </code>
              <Button variant={variant} size="sm">
                {t("buttons.sample")}
              </Button>
              <Button variant={variant} size="md" arrow>
                {t("buttons.sample")}
              </Button>
              <Button variant={variant} size="lg" arrow>
                {t("buttons.sample")}
              </Button>
              <Button variant={variant} disabled>
                {t("buttons.disabled")}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("sections.toggles")}>
        <div className="flex flex-wrap items-center gap-6">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </Section>

      <Section title={t("sections.components")}>
        <div className="space-y-12">
          <Demo name="Card / CardLink">
            <div className="grid gap-6 split:grid-cols-2">
              <Card>
                <VideoCardContent />
              </Card>
              <CardLink href="/styleguide">
                <VideoCardContent arrow />
              </CardLink>
            </div>
          </Demo>

          <Demo name="ProgressBar">
            <div className="grid gap-8 split:grid-cols-2">
              <div>
                <p className="mb-3 text-supporting text-ink-muted">
                  {t("states.segmented")}
                </p>
                <ProgressBarDemo />
              </div>
              <div>
                <p className="mb-3 text-supporting text-ink-muted">
                  {t("states.continuous")}
                </p>
                <ProgressBar value={20} max={52} label={tProgress("today")} />
              </div>
            </div>
          </Demo>

          <Demo name="ScoreBadge">
            <div className="flex flex-wrap gap-12">
              <ScoreBadge score={0.72} />
              <ScoreBadge score={0.86} />
            </div>
          </Demo>

          <Demo name="SentenceRow">
            <SentenceRowDemo />
          </Demo>

          <Demo name="DayTracker">
            <DayTrackerDemo />
          </Demo>

          <Demo name="Icons">
            <ul className="flex flex-wrap gap-6 text-ink">
              {(
                [
                  ["LockIcon", LockIcon],
                  ["PointsIcon", PointsIcon],
                  ["FeedIcon", FeedIcon],
                ] as const
              ).map(([name, Icon]) => (
                <li key={name} className="flex items-center gap-2">
                  <Icon className="size-4" />
                  <code className="text-metadata text-ink-muted">{name}</code>
                </li>
              ))}
            </ul>
          </Demo>

          <Demo name="Divider">
            <Divider />
          </Demo>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <Divider className="mb-8" />
      <h2 className="mb-8 font-display text-h2">{title}</h2>
      {children}
    </section>
  );
}

function Demo({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <code className="mb-4 block text-metadata text-ink-muted">{name}</code>
      {children}
    </div>
  );
}

function VideoCardContent({ arrow = false }: { arrow?: boolean }) {
  return (
    <div lang="en">
      <p className="text-metadata tracking-widest text-ink-muted">
        {sampleVideo.meta}
      </p>
      <p className="mt-4 font-display text-h3">{sampleVideo.title}</p>
      <p className="mt-4 flex justify-between text-supporting text-ink-muted">
        {sampleVideo.source}
        {arrow && <span aria-hidden="true">→</span>}
      </p>
    </div>
  );
}
