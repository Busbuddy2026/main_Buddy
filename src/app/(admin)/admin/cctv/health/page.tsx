"use client";

import { Card, Icon, Mono, SecondaryButton } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAdmin } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import type { listCameras } from "@/server/services/safety";

type Cameras = Awaited<ReturnType<typeof listCameras>>;

const STATUSES = [
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "RECORDING_ISSUE", label: "Recording issue" },
] as const;

/**
 * Camera health per bus. Until devices report their own heartbeat, the office
 * records a camera's state here; "Raise ticket" opens a tracked incident.
 */
export default function CameraHealthPage() {
  const { dispatch } = useStore();
  const { canEdit } = useAdmin();
  const registry = useApi<Cameras>("/api/admin/cctv/cameras");
  const s = registry.data?.stats;

  const STATS = [
    { label: "Total cameras", value: s?.total, accent: "#16181b" },
    { label: "Online", value: s?.online, accent: "#1e8e3e" },
    { label: "Offline", value: s?.offline, accent: "#d93025" },
    { label: "Recording issues", value: s?.issues, accent: "#f29900" },
  ];

  const setStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/api/admin/cctv/cameras/${id}`, { status });
      await registry.reload();
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  const ticket = async (busId: string, bus: string) => {
    try {
      await api.post(`/api/admin/cctv/buses/${busId}/ticket`);
      dispatch({ type: "toast", message: `Support ticket raised for Bus ${bus}. It is on the incidents board.` });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {STATS.map((x) => (
          <Card key={x.label} className="px-[17px] py-[15px]">
            <div className="text-xs text-muted">{x.label}</div>
            <Mono className="mt-1 block text-[28px] font-medium" style={{ color: x.accent }}>
              {x.value ?? "—"}
            </Mono>
          </Card>
        ))}
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {(registry.data?.buses ?? []).map((b) => (
          <Card key={b.busId} className="px-[18px] py-4">
            <div className="flex items-center justify-between gap-2">
              <Mono className="text-sm font-semibold">Bus {b.bus}</Mono>
              <span className="text-[11px] text-faint">Last seen {b.lastSeen}</span>
            </div>
            <div className="mt-[13px] flex flex-col gap-2.5">
              {b.cameras.map((c) => {
                const p = pill(c.view.label, c.view.kind);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-muted">{c.label} camera</span>
                    {canEdit ? (
                      <select
                        aria-label={`Status of Bus ${b.bus} ${c.label} camera`}
                        value={c.status}
                        onChange={(e) => void setStatus(c.id, e.target.value)}
                        className="rounded-chip border border-line bg-surface px-1.5 py-0.5 text-[11.5px] font-semibold"
                        style={{ color: p.fg }}
                      >
                        {STATUSES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: p.fg }}>
                        <span className="size-1.5 rounded-full" style={{ background: p.dot }} />
                        {p.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line-rule pt-3.5">
              <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                <Icon name="memory" size={15} />
                Firmware <Mono>{b.firmware}</Mono>
              </span>
              {canEdit ? (
                <SecondaryButton onClick={() => void ticket(b.busId, b.bus)}>Raise ticket</SecondaryButton>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
