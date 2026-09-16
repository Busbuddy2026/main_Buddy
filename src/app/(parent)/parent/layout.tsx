import type { Metadata } from "next";
import { ParentShell } from "@/components/parent/shell";

export const metadata: Metadata = {
  title: "Parent App — Bharath Vidya Mandir",
  description:
    "Track your child's bus, get boarding alerts and report transport absences.",
};

/**
 * Parent app shell — B0.
 *
 * Host-based routing rewrites `parents.<domain>` onto this `/parent` prefix
 * (README §3); see src/proxy.ts.
 */
export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  return <ParentShell>{children}</ParentShell>;
}
