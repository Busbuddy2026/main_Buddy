"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  Icon,
  IconButton,
  Mono,
  PrimaryButton,
  SearchBox,
  StatusPill,
  TableWrap,
  Td,
  Th,
  Toolbar,
} from "@/components/transport/ui";
import { hit } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";

export default function RoutesPage() {
  const data = useData();
  const router = useRouter();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();
  const [q, setQ] = useState("");

  const rows = data.routes.filter((r) => hit(q, r.name, r.id, r.bus));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/optimize"
        className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-[18px] py-[15px] hover:border-[#c9ced6]"
      >
        <span className="grid size-[34px] shrink-0 place-items-center rounded-control bg-neutral-tint text-muted">
          <Icon name="route" size={19} />
        </span>
        <span className="flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink">Route optimization</span>
            <span className="rounded-[5px] bg-neutral-tint px-1.5 py-[3px] text-[9.5px] font-semibold tracking-[0.05em] text-muted">
              COMING SOON
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-faint">
            Preview how AI planning could shorten these routes and balance bus capacity.
          </span>
        </span>
        <Icon name="chevron_right" size={19} className="text-faint" />
      </Link>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search routes" width={210} />
      </Toolbar>

      <Card className="overflow-hidden">
        <CardHeader
          title="All routes"
          action={
            <PrimaryButton icon="add" onClick={openCreate("Route", "New route")}>
              Add route
            </PrimaryButton>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="No routes match these filters" onClear={() => setQ("")} />
        ) : (
          <TableWrap minWidth={812}>
            <thead>
              <tr>
                <Th>Route</Th>
                <Th>Bus</Th>
                <Th>Stops</Th>
                <Th>Students</Th>
                <Th>Distance</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const actions = rowActions("Route", r.name, r.id);
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-[#fafbfc]"
                    onClick={() => router.push(`/routes/${r.id}`)}
                  >
                    <Td>
                      <div className="text-[13.5px] font-medium text-ink">{r.name}</div>
                      <Mono className="text-[11px] text-faint">{r.id}</Mono>
                    </Td>
                    <Td className="text-muted">{r.bus}</Td>
                    <Td>
                      <Mono>{r.stopCount}</Mono>
                    </Td>
                    <Td>
                      <Mono>{r.students}</Mono>
                    </Td>
                    <Td>
                      <Mono className="text-muted">{r.km}</Mono>
                    </Td>
                    <Td>
                      <Mono className="text-muted">{r.dur}</Mono>
                    </Td>
                    <Td>
                      <StatusPill pill={pill(r.status || "Draft", r.kind || "offline")} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <IconButton name="edit" title={`Edit ${r.name}`} onClick={actions.onEdit} />
                        <IconButton
                          name="delete"
                          title={`Delete ${r.name}`}
                          tone="danger"
                          onClick={actions.onDelete}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
