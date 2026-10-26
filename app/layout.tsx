import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
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
  const locale = await getLocale();

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
          <SiteHeader />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
