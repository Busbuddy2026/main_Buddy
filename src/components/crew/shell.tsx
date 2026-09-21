"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PhoneBody, PhoneFrame, PhoneSplash } from "@/components/mobile/shell";
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
