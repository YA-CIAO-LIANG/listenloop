import type { NextRequest } from "next/server";
import { updateSession } from "@/auth/proxy-session";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Pages only: skip build assets, images, and files with an extension.
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
