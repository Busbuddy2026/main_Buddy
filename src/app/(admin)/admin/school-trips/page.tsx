"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, IconButton, Mono, PrimaryButton, StatusPill } from "@/components/transport/ui";
import { schoolTripRows } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions } from "@/lib/transport/store";

export default function SchoolTripsPage() {
  const data = useData();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();
  const trips = useMemo(() => schoolTripRows(data), [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-[13px] text-muted">
          Off-campus travel is configured here and tracked on the same live map as daily routes.
        </p>
        <PrimaryButton icon="add" onClick={openCreate("Trip", "New school trip")}>
          New school trip
        </PrimaryButton>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {trips.map((t) => {
          const actions = rowActions("Trip", t.name, t.id);
          return (
            <Card key={t.id} className="px-5 py-[18px]">
              <div className="flex items-start gap-2.5">
                <Link href={`/admin/school-trips/${t.id}`} className="min-w-0 flex-1">
                  <Mono className="block text-[11px] text-faint">{t.id}</Mono>
                  <div className="mt-[3px] text-[15px] font-semibold tracking-[-0.015em] text-ink">
                    {t.name}
                  </div>
                  <div className="mt-[3px] text-[12.5px] text-muted">{t.destination}</div>
                </Link>
                <StatusPill pill={t.statusPill} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-rule pt-3.5">
                <Fact label="DATE" value={t.date} />
                <Fact label="DEPARTURE" value={t.depart} mono />
                <Fact label={`BUSES · ${t.busCount}`} value={t.busSummary} />
                <Fact label="STUDENTS" value={t.studentTotal} mono />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/admin/school-trips/${t.id}`}
                  className="flex-1 rounded-[9px] bg-primary py-[9px] text-center text-[12.5px] font-semibold text-white hover:bg-primary-hover"
                >
                  Track trip
                </Link>
                <IconButton name="edit" title={`Edit ${t.name}`} onClick={actions.onEdit} />
                <IconButton
                  name="delete"
                  title={`Delete ${t.name}`}
                  tone="danger"
                  onClick={actions.onDelete}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10.5px] text-faint">{label}</div>
      <div className={`truncate text-[12.5px] font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
