import type { Metadata } from "next";
import { CrewShell } from "@/components/crew/shell";

export const metadata: Metadata = {
  title: "Crew App — Bharath Vidya Mandir",
  description: "Mark boarding and drops for the bus assigned to you today.",
};

/**
 * Attendant app shell — C0. Designed for one-handed use in a moving bus, so
 * primary targets are at least 48px tall (README §8).
 *
 * Host-based routing rewrites `crew.<domain>` onto this `/crew` prefix
 * (README §3); see src/proxy.ts.
 */
export default function CrewLayout({ children }: LayoutProps<"/crew">) {
  return <CrewShell>{children}</CrewShell>;
}
