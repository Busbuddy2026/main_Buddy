"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  Avatar,
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
import { hit, studentRows } from "@/lib/transport/derive";
import { useData, useOpenCreate, useRowActions } from "@/lib/transport/store";

export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsTable />
    </Suspense>
  );
}

function StudentsTable() {
  const data = useData();
  const router = useRouter();
  const params = useSearchParams();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();

  // The header search hands its query over as ?q=
  const [q, setQ] = useState(params.get("q") ?? "");
  const [bus, setBus] = useState("All buses");
  const [route, setRoute] = useState("All routes");
  const [menu, setMenu] = useState<"" | "bus" | "route">("");

  const all = useMemo(() => studentRows(data), [data]);
  const busOptions = ["All buses", ...data.buses.map((b) => `Bus ${b.id}`)];
  const routeOptions = ["All routes", ...data.routes.map((r) => r.name)];

  const rows = all.filter(
    (s) =>
      hit(q, s.name, s.cls, s.stop, s.bus) &&
      (bus === "All buses" || `Bus ${s.bus.replace(/^Bus /, "")}` === bus) &&
      (route === "All routes" || s.route === route),
  );

  const clear = () => {
    setQ("");
    setBus("All buses");
    setRoute("All routes");
    setMenu("");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search name or class" width={220} />
        <Dropdown
          value={bus}
          options={busOptions}
          width={150}
          open={menu === "bus"}
          onToggle={() => setMenu((m) => (m === "bus" ? "" : "bus"))}
          onChange={(v) => {
            setBus(v);
            setMenu("");
          }}
        />
        <Dropdown
          value={route}
          options={routeOptions}
          width={210}
          open={menu === "route"}
          onToggle={() => setMenu((m) => (m === "route" ? "" : "route"))}
          onChange={(v) => {
            setRoute(v);
            setMenu("");
          }}
        />
        <div className="flex-1" />
        <span className="text-xs text-faint">
          {rows.length} of {all.length} shown
        </span>
        <PrimaryButton icon="add" onClick={openCreate("Student", "New student")}>
          Add student
        </PrimaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No students match these filters" onClear={clear} />
        ) : (
          <TableWrap minWidth={730}>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Bus</Th>
                <Th>Stop</Th>
                <Th>Morning</Th>
                <Th>Evening</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const actions = rowActions("Student", s.name, s.id);
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-[#fafbfc]"
                    onClick={() => router.push(`/admin/students/${s.id}`)}
                  >
                    <Td>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <Avatar initial={s.initial} size={32} tone="neutral" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-ink">{s.name}</div>
                          <div className="text-[11.5px] text-faint">{s.cls}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Mono>{s.bus}</Mono>
                    </Td>
                    <Td className="max-w-[200px] truncate text-muted">{s.stop || "—"}</Td>
                    <Td>
                      <StatusPill pill={s.amPill} />
                    </Td>
                    <Td>
                      <StatusPill pill={s.pmPill} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <IconButton name="edit" title={`Edit ${s.name}`} onClick={actions.onEdit} />
                        <IconButton
                          name="delete"
                          title={`Delete ${s.name}`}
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
