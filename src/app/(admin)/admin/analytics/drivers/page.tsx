"use client";

import { useMemo, useState } from "react";
import {
  Card,
  EmptyState,
  Mono,
  ProgressBar,
  SearchBox,
  Toolbar,
} from "@/components/transport/ui";
import { driverRows, hit } from "@/lib/transport/derive";
import { useData } from "@/lib/transport/store";

export default function DriverPerformancePage() {
  const data = useData();
  const [q, setQ] = useState("");

  const all = useMemo(() => driverRows(data), [data]);
  const rows = all.filter((d) => hit(q, d.name, d.bus, d.phone));

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search drivers" width={210} />
        <div className="flex-1" />
        <span className="text-xs text-faint">Last 30 days · all routes</span>
      </Toolbar>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No drivers match these filters" onClear={() => setQ("")} />
        </Card>
      ) : (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {rows.map((d) => (
            <Card key={d.id} className="px-5 py-[18px]">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-tint text-[13px] font-semibold text-muted">
                  {d.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{d.name}</div>
                  <div className="text-[11.5px] text-faint">{d.bus}</div>
                </div>
                <Mono className="text-[22px] font-medium" style={{ color: d.barColor }}>
                  {d.score}
                </Mono>
              </div>

              <ProgressBar
                pct={`${d.score}%`}
                color={d.barColor}
                track="#eceef1"
                className="my-3.5"
              />

              <div className="grid grid-cols-3 gap-2.5">
                <Stat label="SPEED" value={d.speedEvents} />
                <Stat label="BRAKING" value={d.braking} />
                <Stat label="TRIPS" value={d.trips} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint">{label}</div>
      <Mono className="text-[13px] font-medium">{value}</Mono>
    </div>
  );
}
