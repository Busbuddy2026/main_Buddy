"use client";

import Link from "next/link";
import { Card, Mono, StatusPill, Th, TableWrap, Td } from "@/components/transport/ui";
import { BUS_TELEMETRY } from "@/lib/transport/seed";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";

export default function ActiveTripsPage() {
  const { dispatch } = useStore();
  const trips = Object.values(BUS_TELEMETRY).filter((b) => b.kind !== "offline");

  return (
    <Card className="overflow-hidden">
      <TableWrap minWidth={700}>
        <thead>
          <tr>
            <Th>Bus</Th>
            <Th>Route</Th>
            <Th>Progress</Th>
            <Th>Students</Th>
            <Th>Status</Th>
            <Th align="right">ETA</Th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr
              key={t.id}
              className="cursor-pointer hover:bg-[#fafbfc]"
              onClick={() => dispatch({ type: "selectBus", id: t.id })}
            >
              <Td>
                <Link href={`/admin/buses/${t.id}`} className="font-mono text-sm font-semibold text-ink">
                  Bus {t.id}
                </Link>
              </Td>
              <Td>
                <div className="text-[13.5px] font-medium text-ink">{t.route}</div>
                <div className="mt-0.5 text-[11.5px] text-faint">Next: {t.next}</div>
              </Td>
              <Td className="w-[200px]">
                <div className="h-1.5 overflow-hidden rounded-pill bg-line-soft">
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${t.progress}%`,
                      background: t.kind === "delayed" ? "#f29900" : "#1a73e8",
                    }}
                  />
                </div>
                <Mono className="mt-[5px] block text-[11px] text-faint">
                  {t.progress}% complete
                </Mono>
              </Td>
              <Td>
                <Mono className="text-[13px] text-ink-2">
                  {t.students} / {t.cap}
                </Mono>
              </Td>
              <Td>
                <StatusPill pill={pill(t.status, t.kind)} />
              </Td>
              <Td align="right">
                <Mono className="text-[13px] text-muted">{t.eta}</Mono>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="p-[26px] text-center">
        <div className="text-[13px] font-semibold">Bus 04 has not started</div>
        <div className="mt-[3px] text-[12.5px] text-faint">
          GPS offline for 6 minutes. All other scheduled trips are in progress.
        </div>
      </div>
    </Card>
  );
}
