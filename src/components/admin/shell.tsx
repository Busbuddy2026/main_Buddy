"use client";

import type { ReactNode } from "react";
import type { AdminMe } from "@/lib/api/types";
import type { AdminData } from "@/lib/transport/store";
import { AdminLogin } from "@/components/admin/login";
import { EntityDialog, Toast } from "@/components/transport/dialog";
import { Header } from "@/components/transport/header";
import { Sidebar } from "@/components/transport/sidebar";
import { AdminSessionProvider, useAdmin } from "@/lib/transport/admin-store";
import { TransportStoreProvider } from "@/lib/transport/store";

const EMPTY: AdminData = {
  buses: [], routes: [], stops: [], students: [], drivers: [], attendants: [], trips: [], busDocs: {},
};

export function AdminShell({
  me,
  data,
  children,
}: {
  me: AdminMe | null;
  /** Master data, loaded on the server; null while signed out. */
  data: AdminData | null;
  children: ReactNode;
}) {
  return (
    <AdminSessionProvider me={me}>
      {/* Keyed by user so signing in as someone else starts a fresh store. */}
      <TransportStoreProvider key={me?.id ?? "signed-out"} initial={data ?? EMPTY}>
        <Frame>{children}</Frame>
      </TransportStoreProvider>
    </AdminSessionProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { authed } = useAdmin();

  if (!authed) return <AdminLogin />;

  return (
    <>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Header />
          <div className="min-w-0 px-7 pb-[60px] pt-[26px] print:p-0">{children}</div>
        </main>
      </div>
      <EntityDialog />
      <Toast />
    </>
  );
}
