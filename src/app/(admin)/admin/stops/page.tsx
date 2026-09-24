"use client";

import { useState } from "react";
import {
  Card,
  EmptyState,
  IconButton,
  Mono,
  PrimaryButton,
  SearchBox,
} from "@/components/transport/ui";
import { hit } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions } from "@/lib/transport/store";
import { pad } from "@/lib/transport/tone";

export default function StopsPage() {
  const data = useData();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();
  const [q, setQ] = useState("");

  const rows = data.stops
    .map((s, i) => ({ ...s, n: pad(i + 1) }))
    .filter((s) => hit(q, s.name, s.route, s.landmark));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-faint">All stops across every route.</span>
        <SearchBox value={q} onChange={setQ} placeholder="Search stops" width={210} />
        <div className="flex-1" />
        <PrimaryButton icon="add" onClick={openCreate("Stop", "New stop")}>
          Add stop
        </PrimaryButton>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No stops match these filters" onClear={() => setQ("")} />
        </Card>
      ) : (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {rows.map((s) => {
            const actions = rowActions("Stop", s.name, s.id);
            return (
              <Card key={s.id} className="p-4">
                <div className="mb-2 truncate text-[11px] text-faint">{s.route || "Unassigned"}</div>
                <div className="flex items-center gap-2.5">
                  <Mono className="grid size-[26px] shrink-0 place-items-center rounded-chip bg-neutral-tint text-[11px] font-semibold text-muted">
                    {s.n}
                  </Mono>
                  <div className="min-w-0 truncate text-[13px] font-semibold text-ink">{s.name}</div>
                </div>
                <div className="mt-3.5 flex items-end gap-4">
                  <div>
                    <div className="text-[10.5px] text-faint">PICKUP</div>
                    <Mono className="text-[12.5px] font-medium">{s.time}</Mono>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-faint">STUDENTS</div>
                    <div className="text-[12.5px] font-medium">{s.students}</div>
                  </div>
                  <div className="flex flex-1 justify-end gap-1.5">
                    <IconButton name="edit" title={`Edit ${s.name}`} onClick={actions.onEdit} />
                    <IconButton
                      name="delete"
                      title={`Delete ${s.name}`}
                      tone="danger"
                      onClick={actions.onDelete}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
