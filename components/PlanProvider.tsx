"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PlanId } from "@/lib/plans";

const PlanContext = createContext<PlanId>("free");

/** The viewer's plan (D54), set by the layout from the session. */
export function PlanProvider({
  plan,
  children,
}: {
  plan: PlanId;
  children: ReactNode;
}) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanId {
  return useContext(PlanContext);
}
