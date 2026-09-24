import { AdminShell } from "@/components/admin/shell";

/**
 * Admin console shell — 248px sidebar, 60px sticky header, 26/28/60 content
 * padding (SCREENS.md §A0). Everything sits behind the sign-in screen.
 *
 * Served at `/admin`: the root path belongs to the Bus Buddy marketing site,
 * and `admin.<domain>` is rewritten onto this prefix in src/proxy.ts.
 *
 * The providers mount here rather than in the root layout so the parent and
 * crew apps keep their own session and stores under `(parent)` and `(crew)`.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
