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
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAdmin } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";
import { TONE, pill } from "@/lib/transport/tone";
import { formatDay } from "@/lib/time";
import type { listRecordings } from "@/server/services/safety";

type Recordings = Awaited<ReturnType<typeof listRecordings>>;

const EVT_OPTIONS = ["All events", "Safety events", "Stops", "Trip milestones"];
const GROUP: Record<string, string> = { "Safety events": "safety", Stops: "stops", "Trip milestones": "trip" };
const GROUP_TONE = { safety: TONE.delayed, stops: TONE.ontime, trip: TONE.good } as const;

/**
 * Recordings and backup. Clip metadata, backup state and the Drive target are
 * real; playback and the Drive copy itself arrive with the video gateway.
 * Opening a clip is audited (`RECORDING_VIEW`).
 */
export default function RecordingsPage() {
  const { data, dispatch } = useStore();
  const { user } = useAdmin();
  const canBackup = user.role === "SUPER_ADMIN" || user.role === "TRANSPORT_MANAGER";

  const [bus, setBus] = useState("All buses");
  const [day, setDay] = useState("All days");
  const [cam, setCam] = useState("All cameras");
  // The cameras actually fitted, by name ("Channel 1", "Cabin", …).
  const registry = useApi<{ buses: Array<{ cameras: Array<{ label: string }> }> }>("/api/admin/cctv/cameras");
  const camOptions = [
    "All cameras",
    ...[...new Set((registry.data?.buses ?? []).flatMap((b) => b.cameras.map((c) => `${c.label} camera`)))].sort(),
  ];
  const [evt, setEvt] = useState(EVT_OPTIONS[0]!);
  const [menu, setMenu] = useState<"" | "bus" | "day" | "cam" | "evt">("");

  const busUid = data.buses.find((b) => `Bus ${b.id}` === bus)?.uid;
  const query = new URLSearchParams();
  if (busUid) query.set("busId", busUid);
  if (day !== "All days") query.set("day", day);
  if (cam !== "All cameras") query.set("camera", cam.replace(" camera", ""));
  if (GROUP[evt]) query.set("group", GROUP[evt]);
  const rec = useApi<Recordings>(`/api/admin/cctv/recordings?${query.toString()}`);
  const drive = rec.data?.drive;

  const run = async (work: () => Promise<string>) => {
    try {
      dispatch({ type: "toast", message: await work() });
      await rec.reload();
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  const toggleDrive = () =>
    run(async () => {
      if (drive?.driveConnected) {
        await api.put("/api/admin/cctv/drive", { connected: false });
        return "Drive disconnected.";
      }
      const account = window.prompt("Google account that owns the school's backup folder:");
      if (!account) return "Drive not connected.";
      await api.put("/api/admin/cctv/drive", { connected: true, account });
      return `Drive connected · ${account}`;
    });

  const backup = (scope: { busId?: string; day?: string }) =>
    run(async () => {
      const res = await api.post<{ clips: number }>("/api/admin/cctv/backup", scope);
      return res.clips ? `${res.clips} clips marked for backup.` : "Everything here is already backed up.";
    });

  const openClip = async (id: string, label: string) => {
    await api.post(`/api/admin/cctv/recordings/${id}/view`).catch(() => undefined);
    dispatch({ type: "toast", message: `${label}: playback arrives with the video gateway. This view was logged.` });
  };

  const busOptions = ["All buses", ...data.buses.map((b) => `Bus ${b.id}`)];
  const dayOptions = ["All days", ...(rec.data?.days ?? [])];

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line-soft px-5 py-4">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-control"
            style={{
              background: drive?.driveConnected ? "#e6f4ea" : "#f1f3f4",
              color: drive?.driveConnected ? "#186c33" : "#5f6672",
            }}
          >
            <Icon name={drive?.driveConnected ? "cloud_done" : "cloud_off"} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold">Google Drive backup</div>
            <div className="mt-px text-[11.5px] text-faint">
              {!drive ? "Checking…" : drive.driveConnected ? `Connected · ${drive.driveAccount}` : "Not connected"}
            </div>
          </div>
          {canBackup && drive ? (
            <>
              <SecondaryButton onClick={() => void toggleDrive()}>
                {drive?.driveConnected ? "Disconnect" : "Connect"}
              </SecondaryButton>
              <PrimaryButton icon="backup" disabled={!drive?.driveConnected} onClick={() => void backup({})}>
                Back up to Drive
              </PrimaryButton>
            </>
          ) : null}
        </div>

        <TableWrap minWidth={560}>
          <thead>
            <tr>
              <Th>Day</Th>
              <Th>Bus</Th>
              <Th>Clips</Th>
              <Th>Size</Th>
              <Th>Status</Th>
              <Th align="right">Back up</Th>
            </tr>
          </thead>
          <tbody>
            {(rec.data?.backups ?? []).map((r) => (
              <tr key={`${r.day}-${r.busId}`} className="hover:bg-[#fafbfc]">
                <Td className="text-[13px] font-medium text-ink">{r.dayLabel}</Td>
                <Td>
                  <Mono>{r.bus}</Mono>
                </Td>
                <Td className="text-muted">{r.clips}</Td>
                <Td>
                  <Mono className="text-muted">{r.size}</Mono>
                </Td>
                <Td>
                  <StatusPill pill={pill(r.state, r.kind)} />
                </Td>
                <Td align="right">
                  <div className="flex justify-end">
                    <IconButton
                      name="drive_export"
                      title={`Copy ${r.bus} footage for ${r.dayLabel} to Google Drive`}
                      disabled={!canBackup || !drive?.driveConnected || r.state === "Backed up"}
                      onClick={() => void backup({ busId: r.busId, day: r.day })}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>

        <p className="px-5 py-[13px] text-[11.5px] text-faint">
          Footage is retained on device for {rec.data?.retentionDays ?? 30} days. Backed-up days are copied to
          the school&apos;s Drive folder and kept indefinitely.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2.5">
        <Dropdown
          value={bus} options={busOptions} width={130}
          open={menu === "bus"} onToggle={() => setMenu((m) => (m === "bus" ? "" : "bus"))}
          onChange={(v) => { setBus(v); setMenu(""); }}
        />
        <Dropdown
          value={day === "All days" ? day : formatDay(day)} options={dayOptions.map((d) => (d === "All days" ? d : formatDay(d)))} width={150}
          open={menu === "day"} onToggle={() => setMenu((m) => (m === "day" ? "" : "day"))}
          onChange={(v) => { setDay(dayOptions.find((d) => d === v || formatDay(d) === v) ?? "All days"); setMenu(""); }}
        />
        <Dropdown
          value={cam} options={camOptions} width={160}
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
            Pick a clip below · playback arrives with the video gateway
          </Mono>
        </div>
        <div className="px-[22px] pb-[26px] pt-[22px]">
          {rec.data && rec.data.clips.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-faint">No recordings match these filters.</div>
          ) : null}
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {(rec.data?.clips ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openClip(c.id, `${c.bus} · ${c.camera} · ${c.time}`)}
                className="flex items-center gap-[11px] rounded-[11px] border border-line-soft px-[13px] py-[11px] text-left hover:bg-[#fafbfc]"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: GROUP_TONE[c.group].dot }} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium">
                    {c.label} · {c.bus} {c.camera}
                  </div>
                  <Mono className="block text-[11px] text-faint">
                    {formatDay(c.day)} · {c.time} · {c.duration} · {c.size}
                    {c.backedUp ? " · backed up" : ""}
                  </Mono>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
