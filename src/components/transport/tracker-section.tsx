"use client";

import { useEffect, useRef } from "react";
import { TrackerSettingsFields } from "@/components/transport/telematics";
import { Icon } from "@/components/transport/ui";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import type { TrackerSettings } from "@/lib/api/types";
import { useStore } from "@/lib/transport/store";

interface Trackers {
  configured: boolean;
  vehicles: Array<{ vehicleId: string; vehicleNo: string; imei: string; dashcamChannels: number; busId: string | null; bus: string | null }>;
}

const DEFAULTS: TrackerSettings = {
  overspeed: true,
  overspeed_limit: 50,
  engine_on: true,
  geofence_events: false,
  safe_parking: false,
  renewal: true,
  interval: "MINUTE_1",
};

/**
 * "GPS & camera" in the bus form: pick the bus's tracker from the school's
 * LivePin account and set its alerts and reporting interval. The link saves
 * with the bus; the settings go to LivePin right after (see store `save`).
 */
export function TrackerSection() {
  const { dialog, dispatch } = useStore();
  const t = dialog?.tracker;
  const busUid = dialog?.mode === "edit" ? dialog.id : undefined;
  const list = useApi<Trackers>("/api/admin/tracking/vehicles");
  const seeded = useRef(false);

  // On open: preselect the tracker this bus already has, and its settings.
  useEffect(() => {
    if (!list.data || seeded.current || !t) return;
    seeded.current = true;
    const mine = list.data.vehicles.find((v) => v.busId && v.busId === busUid);
    if (!mine) {
      dispatch({ type: "setTracker", patch: { settings: DEFAULTS } });
      return;
    }
    dispatch({ type: "setTracker", patch: { vehicleId: mine.vehicleId, initialVehicleId: mine.vehicleId } });
    api
      .get<TrackerSettings>(`/api/admin/telematics/${busUid}/settings`)
      .then((settings) => dispatch({ type: "setTracker", patch: { settings } }))
      .catch(() => dispatch({ type: "setTracker", patch: { settings: DEFAULTS } }));
  }, [list.data, busUid, t, dispatch]);

  if (!t) return null;
  const forbidden = /role|forbidden/i.test(list.error);

  return (
    <div className="px-6 pb-5">
      <div className="border-t border-line-soft pt-3.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Icon name="satellite_alt" size={18} className="text-muted" />
          GPS &amp; camera
        </div>
        <div className="mt-px text-[11.5px] text-faint">
          The bus&apos;s tracker from the school&apos;s LivePin account. Live position, history, alerts and the dashcam follow from it.
        </div>

        {forbidden ? (
          <div className="mt-3 text-[12.5px] text-muted">Only a super admin or transport manager can set the bus&apos;s tracker.</div>
        ) : list.error ? (
          <div className="mt-3 rounded-control bg-critical-tint px-3 py-2.5 text-[12.5px] font-medium text-critical-text">{list.error}</div>
        ) : list.data && !list.data.configured ? (
          <div className="mt-3 text-[12.5px] text-muted">LivePin is not set up yet. Add the API key in Settings → Tracking provider.</div>
        ) : (
          <>
            <select
              aria-label="Tracker"
              value={t.vehicleId}
              disabled={!list.data}
              onChange={(e) => dispatch({ type: "setTracker", patch: { vehicleId: e.target.value, settings: t.settings ?? DEFAULTS } })}
              className="mt-3 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-[13px]"
            >
              <option value="">{list.data ? "No tracker" : "Loading trackers…"}</option>
              {(list.data?.vehicles ?? []).map((v) => {
                const elsewhere = v.busId && v.busId !== busUid;
                return (
                  <option key={v.vehicleId} value={v.vehicleId} disabled={!!elsewhere}>
                    {v.vehicleNo} · IMEI {v.imei} · {v.dashcamChannels ? `${v.dashcamChannels}-ch dashcam` : "GPS only"}
                    {elsewhere ? ` · on ${v.bus}` : ""}
                  </option>
                );
              })}
            </select>
            {t.vehicleId && t.settings ? (
              <div className="mt-3 rounded-xl border border-line px-4 py-2">
                <TrackerSettingsFields
                  value={t.settings}
                  onChange={(settings) => dispatch({ type: "setTracker", patch: { settings, settingsDirty: true } })}
                />
              </div>
            ) : null}
            {t.initialVehicleId && !t.vehicleId ? (
              <div className="mt-2 text-[12px] text-warning-text">Saving will unlink the tracker from this bus.</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
