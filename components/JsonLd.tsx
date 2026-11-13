import { serializeJsonLd } from "@/lib/seo";

/**
 * Structured data for search engines (D167). The text is our own JSON,
 * escaped by serializeJsonLd so nothing in it can close the element; the
 * type "application/ld+json" is data, never run as a script.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escaped JSON, not markup (D167); React can't set a script's text
      // any other way.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
