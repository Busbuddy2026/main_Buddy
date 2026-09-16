import { EntityDialog, Toast } from "@/components/transport/dialog";
import { Header } from "@/components/transport/header";
import { Sidebar } from "@/components/transport/sidebar";
import { TransportStoreProvider } from "@/lib/transport/store";

/**
 * Admin console shell — 248px sidebar, 60px sticky header, 26/28/60 content
 * padding (SCREENS.md §A0).
 *
 * The store provider sits here rather than in the root layout so the parent and
 * crew apps can mount their own providers under `(parent)` and `(crew)` when
 * host-based routing lands (README §3).
 */
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <TransportStoreProvider>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Header />
          <div className="min-w-0 px-7 pb-[60px] pt-[26px]">{children}</div>
        </main>
      </div>
      <EntityDialog />
      <Toast />
    </TransportStoreProvider>
  );
}
