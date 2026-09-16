"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PhoneBody, PhoneFrame, StatusBar } from "@/components/mobile/shell";
import { CrewFooter } from "@/components/crew/footer";
import { CrewLogin } from "@/components/crew/login";
import { CrewSessionProvider, useCrew } from "@/lib/transport/crew-store";

export function CrewShell({ children }: { children: ReactNode }) {
  return (
    <CrewSessionProvider>
      <Frame>{children}</Frame>
    </CrewSessionProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { authed, trip } = useCrew();
  const pathname = usePathname();
  const onProfile = pathname === "/crew/profile";

  return (
    <PhoneFrame>
      <StatusBar clock={trip === "evening" ? "4:28" : "7:16"} showWifi={false} />
      <PhoneBody>{authed ? children : <CrewLogin />}</PhoneBody>
      {authed && !onProfile ? <CrewFooter /> : null}
    </PhoneFrame>
  );
}
