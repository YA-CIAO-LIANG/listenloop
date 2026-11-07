import { NextResponse } from "next/server";
import { exportAccountData } from "@/auth/account-data";
import { getAdminSupabase } from "@/auth/admin";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";

/**
 * "Download my data" (D60): the signed-in account's data as a JSON file.
 * Who it's for comes from the session only, never the request. Not cached.
 */
export async function GET() {
  const user = await getSignedInUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!(await allowAction("export", user.id))) {
    return new NextResponse(null, { status: 429 });
  }
  const admin = getAdminSupabase();
  if (!admin) return new NextResponse(null, { status: 503 });
  const data = await exportAccountData(admin, user.id);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(
    JSON.stringify({ account: { email: user.email }, ...data }, null, 2),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="listenloop-data-${day}.json"`,
        "cache-control": "no-store",
      },
    },
  );
}
