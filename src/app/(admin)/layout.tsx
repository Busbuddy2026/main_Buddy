import { AdminShell } from "@/components/admin/shell";

/**
 * Admin console shell — 248px sidebar, 60px sticky header, 26/28/60 content
 * padding (SCREENS.md §A0). Everything sits behind the sign-in screen.
 *
 * The providers mount here rather than in the root layout so the parent and
 * crew apps keep their own session and stores under `(parent)` and `(crew)`.
 */
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return <AdminShell>{children}</AdminShell>;
}
