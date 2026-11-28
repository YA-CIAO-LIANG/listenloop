import type { ReactNode } from "react";
import { AreaMessages } from "@/components/AreaMessages";

/**
 * WritingLoop's pages (D187) get the writing messages, and the writing
 * area's own color (teal, D217) for everything inside.
 */
export default function WritingLayout({ children }: { children: ReactNode }) {
  return (
    <AreaMessages area="writing">
      <div data-area="writing" className="flex flex-1 flex-col">
        {children}
      </div>
    </AreaMessages>
  );
}
