import type { Metadata } from "next";
import { CrewShell } from "@/components/crew/shell";
import { db } from "@/server/db";
import { readSession } from "@/server/auth/session";
import { crewMe } from "@/server/services/me";
import { loadCrewPlan } from "@/server/services/crew";

export const metadata: Metadata = {
  title: "Crew App — Transport OS",
  description: "Mark boarding and drops for the bus assigned to you today.",
};

/**
 * Attendant app shell — C0. Designed for one-handed use in a moving bus, so
 * primary targets are at least 48px tall (README §8).
 *
 * Host-based routing rewrites `crew.<domain>` onto this `/crew` prefix
 * (README §3); see src/proxy.ts.
 */
export default async function CrewLayout({ children }: LayoutProps<"/crew">) {
  // Read from the httpOnly `gf_crew` cookie; null renders the sign-in screen.
  const session = await readSession("crew");
  const me = session ? await crewMe(session.actorId, session.schoolId) : null;
  const plan = me && session ? await loadCrewPlan(db, session.actorId, session.schoolId) : null;
  return (
    <CrewShell me={me} plan={plan}>
      {children}
    </CrewShell>
  );
}
