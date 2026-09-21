import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Transport OS — Bharath Vidya Mandir",
  description:
    "School bus tracking, attendance, CCTV and safety console for Bharath Vidya Mandir.",
};

/**
 * `viewport-fit=cover` lets the mobile apps paint under the notch and the home
 * indicator; the shells then pay that back with `env(safe-area-inset-*)`.
 * Zoom is left enabled — pinch-to-zoom is an accessibility affordance, and the
 * inputs already use 16px type so iOS has no reason to zoom on focus.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Material Symbols Rounded is not published in next/font/google's font
            catalogue, so the icon font is linked directly. The lint rule below
            targets the Pages Router; the root layout is the correct place for
            this link in the App Router. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
