import type { Instrumentation } from "next";

/**
 * Every server error goes to the error log (D63), for Admin → Errors:
 * no paid monitoring service, just a table. Best effort: logging must
 * never cause another error.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const [{ getAdminSupabase }, { errorEntry }] = await Promise.all([
      import("@/auth/admin"),
      import("@/lib/error-log"),
    ]);
    const admin = getAdminSupabase();
    if (!admin) return;
    await admin.from("error_logs").insert(errorEntry(error, request, context));
  } catch {
    // The original error is already in the server log.
  }
};
