import { handlePaymentWebhook } from "@/auth/payments";

/**
 * The payment provider's webhook (D85). The body is read as text, exactly
 * as sent, because the signature covers those bytes; nothing is trusted
 * until it verifies (auth/payments.ts).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 64_000) {
    return new Response("too large", { status: 413 });
  }
  const { status, body } = await handlePaymentWebhook(rawBody, request.headers);
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
}
