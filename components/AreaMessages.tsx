import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { clientMessages, type MessageArea } from "@/lib/i18n/client-messages";

/**
 * An area's layout wraps its pages in this, so its Client Components get
 * the area's messages too (D120); the rest of the site never loads them.
 */
export async function AreaMessages({
  area,
  children,
}: {
  area: MessageArea;
  children: ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={clientMessages(messages, area)}>
      {children}
    </NextIntlClientProvider>
  );
}
