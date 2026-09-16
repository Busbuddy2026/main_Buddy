"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  DangerButton,
  Icon,
  Mono,
  StatusPill,
  TableWrap,
  Td,
  Th,
} from "@/components/transport/ui";
import { INCIDENTS } from "@/lib/transport/incidents";
import { useStore } from "@/lib/transport/store";

export default function IncidentsPage() {
  const router = useRouter();
  const { dispatch } = useStore();

  return (
    <div className="flex flex-col gap-4">
      {/* Critical SOS banner — `sos.raised` puts this on screen in production. */}
      <div className="overflow-hidden rounded-card border border-[#fad2cf] bg-surface">
        <div className="h-[3px] bg-critical" />
        <div className="flex flex-wrap items-center gap-4 px-5 py-[18px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-critical-tint text-critical-text">
            <Icon name="emergency_home" size={21} />
          </span>
          <div className="min-w-[240px] flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              Emergency alert · Bus 12
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              SOS triggered by Ramesh Kumar at 7:38 AM near Botanical Garden. 38 students onboard.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/live"
              className="rounded-[9px] border border-line px-[13px] py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              Live location
            </Link>
            <Link
              href="/cctv"
              className="rounded-[9px] border border-line px-[13px] py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              Open CCTV
            </Link>
            <DangerButton
              onClick={() =>
                dispatch({ type: "toast", message: "Calling Ramesh Kumar · +91 98490 33210" })
              }
            >
              Contact driver
            </DangerButton>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <TableWrap minWidth={830}>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Bus</Th>
              <Th>Type</Th>
              <Th>Date &amp; time</Th>
              <Th>Severity</Th>
              <Th>Status</Th>
              <Th>Assigned to</Th>
            </tr>
          </thead>
          <tbody>
            {INCIDENTS.map((i) => (
              <tr
                key={i.id}
                className="cursor-pointer hover:bg-[#fafbfc]"
                onClick={() => router.push(`/incidents/${i.id}`)}
              >
                <Td>
                  <Mono className="text-[12.5px] font-semibold text-ink">{i.id}</Mono>
                </Td>
                <Td>
                  <Mono>{i.bus}</Mono>
                </Td>
                <Td className="text-[13px] font-medium text-ink">{i.type}</Td>
                <Td className="text-muted">{i.when}</Td>
                <Td>
                  <span className="text-[11.5px] font-semibold" style={{ color: i.sev.fg }}>
                    {i.sev.label}
                  </span>
                </Td>
                <Td>
                  <StatusPill pill={i.status} />
                </Td>
                <Td className="text-muted">{i.who}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
