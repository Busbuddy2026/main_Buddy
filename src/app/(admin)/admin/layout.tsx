import { AdminShell } from "@/components/admin/shell";
import { ProgressBar } from "@/components/transport/progress-bar";
import { db } from "@/server/db";
import { readSession } from "@/server/auth/session";
import { adminMe } from "@/server/services/me";
import { loadAdminData } from "@/server/services/masters/view";

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
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await readSession("admin");
  const me = session ? await adminMe(session.actorId, session.schoolId) : null;
  const data = me && session ? await loadAdminData(db, session.schoolId) : null;
  return (
    <>
      <ProgressBar />
      <AdminShell me={me} data={data}>
        {children}
      </AdminShell>
    </>
  );
}
