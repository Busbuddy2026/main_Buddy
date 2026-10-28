import type { ReactNode } from "react";
import { AnalyticsLockButton, AnalyticsPinGate } from "@/components/admin/analytics-pin";
import { analyticsUnlocked } from "@/server/auth/analytics-lock";

/**
 * Every Analytics page sits behind the analytics PIN. Locked, only the PIN
 * screen renders; the APIs behind the pages refuse too.
 */
export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  if (!(await analyticsUnlocked())) return <AnalyticsPinGate />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end print:hidden">
        <AnalyticsLockButton />
      </div>
      {children}
    </div>
  );
}
