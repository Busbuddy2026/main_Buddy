"use client";

import {
  Card,
  Mono,
  ProgressBar,
  SecondaryButton,
  TableWrap,
  Td,
  Th,
  Toolbar,
} from "@/components/transport/ui";
import { useStore } from "@/lib/transport/store";

/** Daily rollups — GET /api/attendance/history once the database is wired. */
const ROWS = [
  { date: "8 Sep 2026", expected: "1,284", boarded: "1,196", absent: "54", dropped: "1,042", pct: "93%" },
  { date: "7 Sep 2026", expected: "1,284", boarded: "1,241", absent: "43", dropped: "1,238", pct: "97%" },
  { date: "5 Sep 2026", expected: "1,281", boarded: "1,208", absent: "68", dropped: "1,205", pct: "94%" },
  { date: "4 Sep 2026", expected: "1,281", boarded: "1,252", absent: "29", dropped: "1,249", pct: "98%" },
  { date: "3 Sep 2026", expected: "1,278", boarded: "1,190", absent: "84", dropped: "1,186", pct: "93%" },
  { date: "2 Sep 2026", expected: "1,278", boarded: "1,244", absent: "34", dropped: "1,240", pct: "97%" },
];

export default function AttendanceHistoryPage() {
  const { dispatch } = useStore();
  const exportAs = (format: string) => () =>
    dispatch({ type: "toast", message: `Attendance history exported as ${format}` });

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <span className="text-[13px] text-muted">2 Sep 2026 – 8 Sep 2026</span>
        <div className="flex-1" />
        <SecondaryButton icon="download" onClick={exportAs("CSV")}>
          Export CSV
        </SecondaryButton>
        <SecondaryButton icon="picture_as_pdf" onClick={exportAs("PDF")}>
          Export PDF
        </SecondaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        <TableWrap minWidth={700}>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Expected</Th>
              <Th>Boarded</Th>
              <Th>Absent</Th>
              <Th>Dropped</Th>
              <Th>Completion</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((h) => (
              <tr key={h.date} className="hover:bg-[#fafbfc]">
                <Td className="text-[13px] font-medium text-ink">{h.date}</Td>
                <Td>
                  <Mono>{h.expected}</Mono>
                </Td>
                <Td>
                  <Mono className="text-success-text">{h.boarded}</Mono>
                </Td>
                <Td>
                  <Mono className="text-critical-text">{h.absent}</Mono>
                </Td>
                <Td>
                  <Mono className="text-primary-hover">{h.dropped}</Mono>
                </Td>
                <Td className="min-w-[150px]">
                  <div className="flex items-center gap-2.5">
                    <ProgressBar pct={h.pct} color="#1e8e3e" track="#eceef1" className="flex-1" />
                    <Mono className="w-10 text-right text-[11.5px] text-muted">{h.pct}</Mono>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
