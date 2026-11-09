import type { ReactNode } from "react";
import { AreaMessages } from "@/components/AreaMessages";

/** This area's messages for its Client Components (D120). */
export default function Layout({ children }: { children: ReactNode }) {
  return <AreaMessages area="styleguide">{children}</AreaMessages>;
}
