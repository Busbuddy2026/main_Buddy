"use client";

import { Icon } from "@/components/transport/ui";
import { useCrew } from "@/lib/transport/crew-store";

/**
 * Whether the attendant's marks have reached the office. Offline is normal on
 * a bus, so it reads as information, not an error; a refused event is the
 * only thing shown in red.
 */
export function SyncBadge({ className = "" }: { className?: string }) {
  const { online, syncing, pendingSync, notice, dismissNotice, syncNow } = useCrew();

  const updates = `${pendingSync} ${pendingSync === 1 ? "update" : "updates"}`;
  const label = !online
    ? `Offline · ${updates} saved on this phone`
    : syncing && pendingSync
      ? `Sending ${updates}…`
      : pendingSync
        ? `${updates} waiting to send`
        : "All marks sent";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void syncNow()}
        className="inline-flex items-center gap-1.5 rounded-pill px-[11px] py-[5px] text-xs font-semibold"
        style={
          !online
            ? { background: "#fef7e0", color: "#8f5b00" }
            : pendingSync
              ? { background: "#e8f0fe", color: "#1558b8" }
              : { background: "#e6f4ea", color: "#186c33" }
        }
      >
        <Icon name={!online ? "cloud_off" : pendingSync ? "cloud_upload" : "cloud_done"} size={15} />
        {label}
      </button>

      {notice ? (
        <div
          role="alert"
          className="mt-2.5 flex items-start gap-2.5 rounded-[13px] bg-critical-tint px-[13px] py-3 text-[12.5px] font-medium text-critical-text"
        >
          <Icon name="error" size={18} className="shrink-0" />
          <div className="min-w-0 flex-1">{notice}</div>
          <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="shrink-0">
            <Icon name="close" size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
