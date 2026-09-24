"use client";

import { useMemo, useState } from "react";
import {
  Card,
  EmptyState,
  IconButton,
  Mono,
  PrimaryButton,
  ProgressBar,
  SearchBox,
  StatusPill,
  TableWrap,
  Td,
  Th,
  Toolbar,
} from "@/components/transport/ui";
import { attendantRows, hit } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions } from "@/lib/transport/store";

export default function AttendantsPage() {
  const data = useData();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();
  const [q, setQ] = useState("");

  const all = useMemo(() => attendantRows(data), [data]);
  const rows = all.filter((a) => hit(q, a.name, a.bus, a.phone));

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search attendants" width={210} />
        <div className="flex-1" />
        <PrimaryButton icon="add" onClick={openCreate("Attendant", "New attendant")}>
          Add attendant
        </PrimaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No attendants match these filters" onClear={() => setQ("")} />
        ) : (
          <TableWrap minWidth={780}>
            <thead>
              <tr>
                <Th>Attendant</Th>
                <Th>Bus</Th>
                <Th>Route</Th>
                <Th>Attendance marked</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const actions = rowActions("Attendant", a.name, a.id);
                return (
                  <tr key={a.id} className="hover:bg-[#fafbfc]">
                    <Td>
                      <div className="text-[13px] font-medium text-ink">{a.name}</div>
                      <Mono className="block text-[11.5px] text-faint">{a.phone}</Mono>
                    </Td>
                    <Td>
                      <Mono>{a.bus}</Mono>
                    </Td>
                    <Td className="text-muted">{a.route}</Td>
                    <Td className="w-[170px]">
                      <Mono className="text-[13px] font-semibold text-ink">{a.ratio}</Mono>
                      <ProgressBar pct={a.pct} height={4} className="mt-1.5" />
                    </Td>
                    <Td>
                      <StatusPill pill={a.statusPill} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <IconButton name="edit" title={`Edit ${a.name}`} onClick={actions.onEdit} />
                        <IconButton
                          name="delete"
                          title={`Delete ${a.name}`}
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
