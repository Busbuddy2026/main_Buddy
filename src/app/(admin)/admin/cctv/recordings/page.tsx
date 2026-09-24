"use client";

import { useState } from "react";
import {
  Card,
  Dropdown,
  Icon,
  IconButton,
  Mono,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TableWrap,
  Td,
  Th,
} from "@/components/transport/ui";
import { useStore } from "@/lib/transport/store";
import { TONE, pill, type ToneKind } from "@/lib/transport/tone";

/** Event-indexed clips. Positions are a share of the visible hour. */
const EVENTS = [
  { time: "08:15", label: "Harsh braking event", left: "25%", tone: TONE.delayed },
  { time: "08:34", label: "Route stop · Botanical Garden", left: "57%", tone: TONE.ontime },
  { time: "08:42", label: "Door open · 42 seconds", left: "70%", tone: TONE.ontime },
  { time: "08:55", label: "Trip completed", left: "92%", tone: TONE.good },
];

const BUS_OPTIONS = ["Bus 12", "Bus 08", "Bus 21", "Bus 04", "Bus 17", "Bus 09"];
const DAY_OPTIONS = ["8 Sep 2026", "7 Sep 2026", "5 Sep 2026"];
const CAM_OPTIONS = ["Cabin camera", "Front camera", "Door camera"];
const EVT_OPTIONS = ["All events", "Safety events", "Stops", "Trip milestones"];

export default function RecordingsPage() {
  const { driveConnected, backedUp, dispatch } = useStore();

  const [bus, setBus] = useState(BUS_OPTIONS[0]);
  const [day, setDay] = useState(DAY_OPTIONS[0]);
  const [cam, setCam] = useState(CAM_OPTIONS[0]);
  const [evt, setEvt] = useState(EVT_OPTIONS[0]);
  const [menu, setMenu] = useState<"" | "bus" | "day" | "cam" | "evt">("");

  const events = EVENTS.filter((e) => {
    if (evt === "All events") return true;
    if (evt === "Safety events") return /braking|speed|harsh/i.test(e.label);
    if (evt === "Stops") return /stop|door/i.test(e.label);
    return /trip/i.test(e.label);
  });

  const backupRows = [
    { day: "Today · 8 Sep 2026", bus: "Bus 12", clips: "18 clips", size: "4.2 GB", state: backedUp ? "Backed up" : "On device" },
    { day: "Today · 8 Sep 2026", bus: "Bus 08", clips: "16 clips", size: "3.8 GB", state: backedUp ? "Backed up" : "On device" },
    { day: "7 Sep 2026", bus: "Bus 21", clips: "20 clips", size: "4.6 GB", state: "Backed up" },
    { day: "5 Sep 2026", bus: "Bus 12", clips: "17 clips", size: "3.9 GB", state: "Backed up" },
    { day: "4 Sep 2026", bus: "Bus 04", clips: "12 clips", size: "2.7 GB", state: "Expiring in 4 days" },
  ].map((r) => {
    const kind: ToneKind =
      r.state === "Backed up" ? "good" : r.state === "On device" ? "delayed" : "bad";
    return { ...r, status: pill(r.state, kind) };
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line-soft px-5 py-4">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-control"
            style={{
              background: driveConnected ? "#e6f4ea" : "#f1f3f4",
              color: driveConnected ? "#186c33" : "#5f6672",
            }}
          >
            <Icon name={driveConnected ? "cloud_done" : "cloud_off"} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold">Google Drive backup</div>
            <div className="mt-px text-[11.5px] text-faint">
              {driveConnected
                ? "Connected · greenfield-transport@school.edu"
                : "Not connected"}
            </div>
          </div>
          <SecondaryButton onClick={() => dispatch({ type: "toggleDrive" })}>Manage</SecondaryButton>
          <PrimaryButton icon="backup" onClick={() => dispatch({ type: "backupAll" })}>
            Back up to Drive
          </PrimaryButton>
        </div>

        <TableWrap minWidth={560}>
          <thead>
            <tr>
              <Th>Day</Th>
              <Th>Bus</Th>
              <Th>Clips</Th>
              <Th>Size</Th>
              <Th>Status</Th>
              <Th align="right">Get</Th>
            </tr>
          </thead>
          <tbody>
            {backupRows.map((r) => (
              <tr key={`${r.day}-${r.bus}`} className="hover:bg-[#fafbfc]">
                <Td className="text-[13px] font-medium text-ink">{r.day}</Td>
                <Td>
                  <Mono>{r.bus}</Mono>
                </Td>
                <Td className="text-muted">{r.clips}</Td>
                <Td>
                  <Mono className="text-muted">{r.size}</Mono>
                </Td>
                <Td>
                  <StatusPill pill={r.status} />
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1.5">
                    <IconButton name="download" title={`Download footage for ${r.bus}`} />
                    <IconButton
                      name="drive_export"
                      title={`Copy ${r.bus} footage to Google Drive`}
                      onClick={() => dispatch({ type: "backupAll" })}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        <p className="px-5 py-[13px] text-[11.5px] text-faint">
          Footage is retained on device for 30 days. Backed-up days are copied to the school&apos;s
          Drive folder and kept indefinitely.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2.5">
        <Dropdown
          value={bus} options={BUS_OPTIONS} width={130}
          open={menu === "bus"} onToggle={() => setMenu((m) => (m === "bus" ? "" : "bus"))}
          onChange={(v) => { setBus(v); setMenu(""); }}
        />
        <Dropdown
          value={day} options={DAY_OPTIONS} width={150}
          open={menu === "day"} onToggle={() => setMenu((m) => (m === "day" ? "" : "day"))}
          onChange={(v) => { setDay(v); setMenu(""); }}
        />
        <Dropdown
          value={cam} options={CAM_OPTIONS} width={160}
          open={menu === "cam"} onToggle={() => setMenu((m) => (m === "cam" ? "" : "cam"))}
          onChange={(v) => { setCam(v); setMenu(""); }}
        />
        <Dropdown
          value={evt} options={EVT_OPTIONS} width={170}
          open={menu === "evt"} onToggle={() => setMenu((m) => (m === "evt" ? "" : "evt"))}
          onChange={(v) => { setEvt(v); setMenu(""); }}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="relative grid aspect-[16/7] place-items-center bg-video">
          <Icon name="play_circle" size={44} style={{ color: "rgba(255,255,255,.3)" }} />
          <Mono className="absolute left-3.5 top-3 text-[11.5px] text-white/70">
            {bus} · {cam.replace(" camera", "")} · {day} · 08:15:04
          </Mono>
        </div>
        <div className="px-[22px] pb-[26px] pt-[22px]">
          <div className="flex items-center justify-between">
            <Mono className="text-[11.5px] text-faint">08:00</Mono>
            <Mono className="text-[11.5px] text-faint">Timeline</Mono>
            <Mono className="text-[11.5px] text-faint">09:00</Mono>
          </div>
          <div className="relative mb-[30px] mt-2.5 h-2 rounded-pill bg-line-soft">
            <div className="absolute inset-y-0 left-0 w-[32%] rounded-pill bg-primary" />
            {events.map((e) => (
              <span
                key={e.time}
                title={`${e.label} · ${e.time}`}
                className="absolute -top-1 -ml-2 size-4 rounded-full border-[3px] border-white"
                style={{
                  left: e.left,
                  background: e.tone.dot,
                  boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                }}
              />
            ))}
          </div>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {events.map((e) => (
              <div
                key={e.time}
                className="flex items-center gap-[11px] rounded-[11px] border border-line-soft px-[13px] py-[11px] hover:bg-[#fafbfc]"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: e.tone.dot }} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium">{e.label}</div>
                  <Mono className="block text-[11px] text-faint">{e.time}</Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
