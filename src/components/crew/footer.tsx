"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { ConfirmSheet } from "@/components/mobile/shell";
import { rosterFor, useCrew } from "@/lib/transport/crew-store";
import { Mono } from "@/components/transport/ui";

/**
 * Sticky action bar. Its contents change per screen: start the trip on home,
 * SOS plus next stop while marking, complete the trip on the summary.
 */
export function CrewFooter() {
  const session = useCrew();
  const router = useRouter();
  const pathname = usePathname();
  // SOS is confirmed before firing — the button sits under a thumb in a moving bus.
  const [confirmingSos, setConfirmingSos] = useState(false);

  const { stop, phase, stops, stopIndex, isLastStop, trip, pendingTotal } = session;
  const roster = rosterFor(session, stop, phase);
  const pendingHere = roster.filter((r) => r.pending).length;

  if (pathname === "/crew") {
    return (
      <Footer>
        <button
          type="button"
          onClick={() => {
            session.goToStop(0);
            router.push("/crew/stop");
          }}
          className="w-full rounded-2xl bg-primary py-[18px] text-base font-bold tracking-[0.01em] text-white hover:bg-primary-hover"
        >
          START TRIP
        </button>
      </Footer>
    );
  }

  if (pathname === "/crew/stop") {
    return (
      <>
        {confirmingSos ? (
          <ConfirmSheet
            title="Raise an emergency alert?"
            body="The school office, the transport manager and the parents of every student onboard are notified immediately. Your live location and cabin camera are shared."
            confirmLabel="Send emergency alert"
            cancelLabel="Cancel"
            onConfirm={() => {
              session.setSos(true);
              setConfirmingSos(false);
            }}
            onCancel={() => setConfirmingSos(false)}
          />
        ) : null}
        <Footer>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmingSos(true)}
            className="w-[74px] shrink-0 rounded-[14px] bg-critical py-[15px] text-center text-sm font-bold text-white hover:bg-critical-hover"
          >
            SOS
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-faint">Pending at {stop.short}</div>
            <Mono
              className="text-[17px] font-semibold"
              style={{ color: pendingHere ? "#f29900" : "#1e8e3e" }}
            >
              {pendingHere}
            </Mono>
          </div>
          <button
            type="button"
            disabled={pendingHere > 0}
            onClick={() => {
              if (isLastStop) router.push("/crew/summary");
              else session.goToStop(stopIndex + 1);
            }}
            className="shrink-0 rounded-[14px] px-[22px] py-[15px] text-[15px] font-bold disabled:cursor-not-allowed"
            style={
              pendingHere
                ? { background: "#f1f3f4", color: "#8b919b" }
                : { background: "#1a73e8", color: "#fff" }
            }
          >
            {isLastStop ? "Finish" : "Next stop"}
          </button>
        </div>
        </Footer>
      </>
    );
  }

  if (pathname === "/crew/summary") {
    return (
      <Footer>
        <button
          type="button"
          disabled={pendingTotal > 0}
          onClick={() => {
            session.resetTrip();
            router.push("/crew");
          }}
          className="w-full rounded-2xl py-[18px] text-base font-bold tracking-[0.01em] disabled:cursor-not-allowed"
          style={
            pendingTotal
              ? { background: "#f1f3f4", color: "#8b919b" }
              : { background: "#1a73e8", color: "#fff" }
          }
        >
          {pendingTotal
            ? `COMPLETE TRIP · ${pendingTotal} PENDING`
            : `COMPLETE ${trip === "evening" ? "EVENING" : "MORNING"} TRIP`}
        </button>
        <span className="sr-only">{stops.length} stops on this trip</span>
      </Footer>
    );
  }

  return null;
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-line-soft bg-surface px-5 pb-5 pt-3.5">{children}</div>
  );
}
