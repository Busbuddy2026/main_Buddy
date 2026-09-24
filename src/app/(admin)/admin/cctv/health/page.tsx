"use client";

import { Card, Icon, Mono, SecondaryButton } from "@/components/transport/ui";
import { BUS_TELEMETRY } from "@/lib/transport/seed";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";

const STATS = [
  { label: "Total cameras", value: "72", accent: "#16181b" },
  { label: "Online", value: "68", accent: "#1e8e3e" },
  { label: "Offline", value: "3", accent: "#d93025" },
  { label: "Recording issues", value: "1", accent: "#f29900" },
];

export default function CameraHealthPage() {
  const { dispatch } = useStore();

  const buses = Object.values(BUS_TELEMETRY).map((b) => ({
    id: b.id,
    seen: b.id === "08" ? "3 minutes ago" : "12 seconds ago",
    rows: [
      { name: "Front camera", status: pill("Online", "good") },
      { name: "Cabin camera", status: pill("Online", "good") },
      {
        name: "Door camera",
        status: b.id === "08" ? pill("Offline", "bad") : pill("Online", "good"),
      },
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label} className="px-[17px] py-[15px]">
            <div className="text-xs text-muted">{s.label}</div>
            <Mono className="mt-1 block text-[28px] font-medium" style={{ color: s.accent }}>
              {s.value}
            </Mono>
          </Card>
        ))}
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {buses.map((b) => (
          <Card key={b.id} className="px-[18px] py-4">
            <div className="flex items-center justify-between gap-2">
              <Mono className="text-sm font-semibold">Bus {b.id}</Mono>
              <span className="text-[11px] text-faint">Last seen {b.seen}</span>
            </div>
            <div className="mt-[13px] flex flex-col gap-2.5">
              {b.rows.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-muted">{r.name}</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
                    style={{ color: r.status.fg }}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: r.status.dot }} />
                    {r.status.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line-rule pt-3.5">
              <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                <Icon name="sd_card" size={15} />
                Storage 61% · firmware 4.2.1
              </span>
              <SecondaryButton
                onClick={() =>
                  dispatch({ type: "toast", message: `Support ticket raised for Bus ${b.id}` })
                }
              >
                Raise ticket
              </SecondaryButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
