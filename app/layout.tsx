import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { canCreatePractices } from "@/auth/creator";
import { getSignedInUser } from "@/auth/session";
import { AccountMenu } from "@/components/AccountMenu";
import { SignInNotice } from "@/components/SignInNotice";
import { UsageNotice } from "@/components/UsageNotice";
import { USAGE_NOTICE_COOKIE } from "@/lib/notices";
import { cookies, headers } from "next/headers";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PlanProvider } from "@/components/PlanProvider";
import { StoresProvider } from "@/components/StoresProvider";
import { clientMessages } from "@/lib/i18n/client-messages";
import { planFor } from "@/lib/plans";
import { accountsEnabled } from "@/lib/supabase/config";
import { fontVariables } from "./fonts";
import { themeInitScript } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import "./backgrounds.css";

/**
 * Every page is laid out at the phone's own width (D140), stated here
 * rather than left to the framework's default.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([
    getTranslations("metadata"),
    getLocale(),
  ]);
  return {
    metadataBase: new URL(SITE_URL),
    // Each page's own title, then the app's name (D61).
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("title"),
      description: t("description"),
      locale: locale === "en" ? "en_US" : "zh_TW",
    },
    twitter: { card: "summary_large_image" },
    appleWebApp: {
      capable: true,
      title: t("siteName"),
      statusBarStyle: "default",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, user, tCommon, cookieStore, headerStore] = await Promise.all([
    getLocale(),
    accountsEnabled ? getSignedInUser() : null,
    getTranslations("common"),
    cookies(),
    headers(),
  ]);
  // This request's CSP nonce, for the inline theme script (D63).
  const nonce = headerStore.get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning: the theme script sets data-theme before hydration.
    <html
      lang={locale}
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        {/* The locale from i18n/request.ts; only the messages Client
            Components use everywhere (D120). */}
        <NextIntlClientProvider messages={clientMessages(await getMessages())}>
          <PlanProvider plan={planFor(user)}>
            {/* Signed in: progress syncs with the account (b3). */}
            <StoresProvider
              key={user?.id ?? "guest"}
              userId={user?.id ?? null}
              accounts={accountsEnabled}
            >
              {/* Keyboard users skip the header (D61). */}
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-base focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow"
              >
                {tCommon("skipToContent")}
              </a>
              <SiteHeader
                showMaterials={!!user}
                showCreate={canCreatePractices(user)}
                showAdmin={user?.role === "admin"}
                account={
                  accountsEnabled && (
                    // useSearchParams inside: Suspense keeps the page renderable.
                    <Suspense fallback={null}>
                      <AccountMenu user={user && { email: user.email }} />
                    </Suspense>
                  )
                }
              />
              {accountsEnabled && (
                <Suspense fallback={null}>
                  <SignInNotice />
                </Suspense>
              )}
              {!cookieStore.has(USAGE_NOTICE_COOKIE) && <UsageNotice />}
              <div
                id="main"
                tabIndex={-1}
                className="flex flex-1 flex-col outline-none"
              >
                {children}
              </div>
              <SiteFooter />
              <ServiceWorker />
            </StoresProvider>
          </PlanProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
