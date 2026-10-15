"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { CrewMe } from "@/lib/api/types";
import type { CrewPlan } from "@/lib/api/schemas/crew";
import { PhoneBody, PhoneFrame, PhoneSplash } from "@/components/mobile/shell";
import { CrewFooter } from "@/components/crew/footer";
import { CrewLogin } from "@/components/crew/login";
import { CrewSessionProvider, useCrew } from "@/lib/transport/crew-store";

export function CrewShell({
  me,
  plan,
  children,
}: {
  me: CrewMe | null;
  plan: CrewPlan | null;
  children: ReactNode;
}) {
  return (
    <CrewSessionProvider me={me} initialPlan={plan}>
      <Frame>{children}</Frame>
    </CrewSessionProvider>
  );
}

/** Production only: the dev server's hot reload and a caching worker do not mix. */
function useOfflineShell() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/crew-sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
}

function Frame({ children }: { children: ReactNode }) {
  useOfflineShell();
  const { authed, hydrated } = useCrew();
  const pathname = usePathname();
  const onProfile = pathname === "/crew/profile";

  if (!hydrated) {
    return (
      <PhoneFrame>
        <PhoneSplash />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <PhoneBody>{authed ? children : <CrewLogin />}</PhoneBody>
      {authed && !onProfile ? <CrewFooter /> : null}
    </PhoneFrame>
  );
}
