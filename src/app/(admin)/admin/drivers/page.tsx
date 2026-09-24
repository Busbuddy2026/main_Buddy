"use client";

import { useMemo, useState } from "react";
import {
  Card,
  EmptyState,
  Icon,
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
import { driverRows, hit } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions } from "@/lib/transport/store";

export default function DriversPage() {
  const data = useData();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();
  const [q, setQ] = useState("");

  const all = useMemo(() => driverRows(data), [data]);
  const rows = all.filter((d) => hit(q, d.name, d.bus, d.phone));

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search drivers" width={210} />
        <div className="flex-1" />
        <PrimaryButton icon="add" onClick={openCreate("Driver", "New driver")}>
          Add driver
        </PrimaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No drivers match these filters" onClear={() => setQ("")} />
        ) : (
          <TableWrap minWidth={866}>
            <thead>
              <tr>
                <Th>Driver</Th>
                <Th>Bus</Th>
                <Th>Licence</Th>
                <Th>Today</Th>
                <Th>Safety score</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const actions = rowActions("Driver", d.name, d.id);
                return (
                  <tr key={d.id} className="hover:bg-[#fafbfc]">
                    <Td>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-tint text-xs font-semibold text-muted">
                          {d.initials}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-ink">{d.name}</div>
                          <Mono className="block text-[11.5px] text-faint">{d.phone}</Mono>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Mono>{d.bus}</Mono>
                    </Td>
                    <Td>
                      <Mono className="block text-[11.5px] text-muted">{d.licence}</Mono>
                      <StatusPill pill={d.licPill} className="mt-1" />
                      <div
                        className="mt-1 flex items-center gap-1 text-[10.5px]"
                        style={{ color: d.docFg }}
                      >
                        <Icon name={d.docGlyph} size={13} />
                        {d.docLabel}
                      </div>
                    </Td>
                    <Td className="text-muted">{d.today}</Td>
                    <Td className="w-[120px]">
                      <Mono className="text-[13px] font-semibold text-ink">{d.score}</Mono>
                      <ProgressBar
                        pct={`${d.score}%`}
                        color={d.barColor}
                        height={4}
                        className="mt-1.5"
                      />
                    </Td>
                    <Td>
                      <StatusPill pill={d.statusPill} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <IconButton name="edit" title={`Edit ${d.name}`} onClick={actions.onEdit} />
                        <IconButton
                          name="delete"
                          title={`Delete ${d.name}`}
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
