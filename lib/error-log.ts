/**
 * Server errors for the admin dashboard (D63): what failed and where,
 * trimmed, with personal details taken out. Query strings are dropped
 * from the path (they can carry tokens or search text), and email
 * addresses are masked in the message and stack.
 */
export type ErrorEntry = {
  digest: string | null;
  message: string;
  path: string | null;
  method: string | null;
  route_type: string | null;
  stack: string | null;
};

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const clean = (text: string, max: number) =>
  text.replace(EMAIL, "<email>").slice(0, max);

export function errorEntry(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string },
): ErrorEntry {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (err as Error & { digest?: unknown }).digest;
  return {
    digest: typeof digest === "string" ? digest.slice(0, 100) : null,
    message: clean(err.message || err.name || "Error", 1000),
    path: request.path ? request.path.split("?")[0].slice(0, 300) : null,
    method: request.method?.slice(0, 10) ?? null,
    route_type: context.routeType?.slice(0, 40) ?? null,
    stack: err.stack ? clean(err.stack, 4000) : null,
  };
}
