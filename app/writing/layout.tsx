import type { ReactNode } from "react";
import { AreaMessages } from "@/components/AreaMessages";

/** WritingLoop's pages (D187) get the writing messages. */
export default function WritingLayout({ children }: { children: ReactNode }) {
  return <AreaMessages area="writing">{children}</AreaMessages>;
}
