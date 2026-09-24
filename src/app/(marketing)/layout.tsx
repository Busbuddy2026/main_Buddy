import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import { SiteFooter } from "@/components/marketing/footer";
import { SiteHeader } from "@/components/marketing/header";
import { Cursor, RevealWatcher } from "@/components/marketing/motion";

/**
 * Bus Buddy marketing site — the public face at the root of the domain.
 *
 * The three products live behind it: `/admin` (and `admin.<domain>`),
 * `/parent`, `/crew`. Everything here is static; only the cursor, the reveal
 * observer and the handful of interactive widgets reach the client.
 */

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["200", "300", "400", "600", "800"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Bus Buddy — every journey, accounted for",
    template: "%s — Bus Buddy",
  },
  description:
    "Live location, boarding confirmation and safety records for the twenty minutes of a school day nobody can see.",
};

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div
      className={`bb-root ${sora.variable} ${jetBrainsMono.variable} flex min-h-dvh flex-col overflow-x-hidden`}
    >
      <Cursor />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <RevealWatcher />
    </div>
  );
}
