import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminUser } from "@/auth/creator";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The admin dashboard (D56): every page under /admin is for admins only;
 * everyone else gets a 404, as if it didn't exist. The section nav sits
 * above each page.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await getAdminUser())) notFound();
  return (
    <>
      <div className="mx-auto w-full max-w-content px-4 pt-6 split:px-6">
        <AdminNav />
      </div>
      {children}
    </>
  );
}
