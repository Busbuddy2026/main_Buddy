import type { Metadata } from "next";
import { ParentShell } from "@/components/parent/shell";
import { ProgressBar } from "@/components/transport/progress-bar";
import { loadParentMe } from "@/server/services/me";

export const metadata: Metadata = {
  title: "Parent App — Transport OS",
  description:
    "Track your child's bus, get boarding alerts and report transport absences.",
};

/**
 * Parent app shell — B0.
 *
 * Host-based routing rewrites `parents.<domain>` onto this `/parent` prefix
 * (README §3); see src/proxy.ts.
 */
export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  // Read from the httpOnly `gf_parent` cookie; null renders the sign-in screen.
  const me = await loadParentMe();
  return (
    <>
      <ProgressBar />
      <ParentShell me={me}>{children}</ParentShell>
    </>
  );
}
