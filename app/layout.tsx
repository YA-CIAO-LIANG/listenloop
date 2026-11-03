import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { canCreatePractices } from "@/auth/creator";
import { isAdminEmail } from "@/lib/admin";
import { getSignedInUser } from "@/auth/session";
import { AccountMenu } from "@/components/AccountMenu";
import { SignInNotice } from "@/components/SignInNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoresProvider } from "@/components/StoresProvider";
import { accountsEnabled } from "@/lib/supabase/config";
import { fontVariables } from "./fonts";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, user] = await Promise.all([
    getLocale(),
    accountsEnabled ? getSignedInUser() : null,
  ]);

  return (
    // suppressHydrationWarning: the theme script sets data-theme before hydration.
    <html
      lang={locale}
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Inherits locale and messages from i18n/request.ts. */}
        <NextIntlClientProvider>
          {/* Signed in: progress syncs with the account (b3). */}
          <StoresProvider key={user?.id ?? "guest"} userId={user?.id ?? null}>
            <SiteHeader
              showCreate={canCreatePractices(user)}
              showNotebooks={!!user && isAdminEmail(user.email)}
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
            {children}
            <SiteFooter />
          </StoresProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
