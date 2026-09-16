"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Card,
  Dropdown,
  EmptyState,
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
import { busRows, hit } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions, useStore } from "@/lib/transport/store";

export default function BusesPage() {
  const data = useData();
  const router = useRouter();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();
  const { dispatch } = useStore();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [menuOpen, setMenuOpen] = useState(false);

  const all = useMemo(() => busRows(data), [data]);

  // Status options collapse "Delayed 12 min" down to "Delayed".
  const statusOptions = useMemo(
    () => [
      "All statuses",
      ...Array.from(
        new Set(all.map((b) => b.status.replace(/\s*\d+\s*min$/, "").trim()).filter(Boolean)),
      ),
    ],
    [all],
  );

  const rows = all.filter(
    (b) =>
      hit(q, b.id, b.reg, b.driver, b.route) &&
      (status === "All statuses" || b.status.toLowerCase().includes(status.toLowerCase())),
  );

  const clear = () => {
    setQ("");
    setStatus("All statuses");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search buses" width={200} />
        <Dropdown
          value={status}
          options={statusOptions}
          open={menuOpen}
          onToggle={() => setMenuOpen((o) => !o)}
          onChange={(v) => {
            setStatus(v);
            setMenuOpen(false);
          }}
        />
        <div className="flex-1" />
        <PrimaryButton icon="add" onClick={openCreate("Bus", "New bus")}>
          Add bus
        </PrimaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No buses match these filters" onClear={clear} />
        ) : (
          <TableWrap minWidth={806}>
            <thead>
              <tr>
                <Th>Bus</Th>
                <Th>Registration</Th>
                <Th>Driver</Th>
                <Th>Students</Th>
                <Th>GPS</Th>
                <Th>CCTV</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const actions = rowActions("Bus", `Bus ${b.id}`, b.id);
                return (
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-[#fafbfc]"
                    onClick={() => {
                      dispatch({ type: "selectBus", id: b.trackedId });
                      router.push(`/buses/${b.trackedId}`);
                    }}
                  >
                    <Td>
                      <Mono className="text-[13.5px] font-semibold text-ink">Bus {b.id}</Mono>
                    </Td>
                    <Td>
                      <Mono className="text-muted">{b.reg}</Mono>
                    </Td>
                    <Td>
                      <div className="text-[13px] font-medium text-ink">{b.driver}</div>
                      <div className="text-[11.5px] text-faint">{b.route}</div>
                    </Td>
                    <Td>
                      <Mono>{b.ratio}</Mono>
                    </Td>
                    <Td>
                      <span className="text-[11.5px] font-semibold" style={{ color: b.gps.fg }}>
                        {b.gps.label}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[11.5px] font-semibold" style={{ color: b.cam.fg }}>
                        {b.cam.label}
                      </span>
                    </Td>
                    <Td>
                      <StatusPill pill={b.statusPill} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <IconButton name="edit" title={`Edit Bus ${b.id}`} onClick={actions.onEdit} />
                        <IconButton
                          name="delete"
                          title={`Delete Bus ${b.id}`}
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
