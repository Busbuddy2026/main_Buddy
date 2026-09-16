"use client";

import type { ReactNode } from "react";
import { AdminLogin } from "@/components/admin/login";
import { EntityDialog, Toast } from "@/components/transport/dialog";
import { Header } from "@/components/transport/header";
import { Sidebar } from "@/components/transport/sidebar";
import { AdminSessionProvider, useAdmin } from "@/lib/transport/admin-store";
import { TransportStoreProvider } from "@/lib/transport/store";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <TransportStoreProvider>
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
          <div className="min-w-0 px-7 pb-[60px] pt-[26px]">{children}</div>
        </main>
      </div>
      <EntityDialog />
      <Toast />
    </>
  );
}
