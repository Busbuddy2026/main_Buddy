import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPauses, nearestPoint, splitTrips, type TimelinePeriod, type TrackPoint } from "@/lib/trips";

// Bus 5965's day as LivePin reported it on 27 Oct 2026 (UTC; IST is +5:30).
const TIMELINE: TimelinePeriod[] = [
  { type: "STOP", start: "2026-10-26T18:30:00.000Z", end: "2026-10-27T01:57:18.000Z", address: "Kadayanallur" },
  { type: "MOVE", start: "2026-10-27T01:57:18.000Z", end: "2026-10-27T02:03:27.000Z", address: null },
  { type: "STOP", start: "2026-10-27T02:03:27.000Z", end: "2026-10-27T02:17:14.000Z", address: "Gandhi Bazaar" },
  { type: "MOVE", start: "2026-10-27T02:17:14.000Z", end: "2026-10-27T03:46:19.000Z", address: null },
  { type: "STOP", start: "2026-10-27T03:46:19.000Z", end: "2026-10-27T10:43:25.000Z", address: "Ilanji" },
  { type: "MOVE", start: "2026-10-27T10:43:25.000Z", end: "2026-10-27T12:06:55.000Z", address: null },
  { type: "STOP", start: "2026-10-27T12:06:55.000Z", end: "2026-10-27T18:29:59.999Z", address: "Kadayanallur" },
];
const STOPS = [{ start: "2026-10-27T02:03:27.000Z", address: "Gandhi Bazaar, Puliyangudi", at: { lat: 9.17, lng: 77.39 } }];

// A point a minute, walking north ~200 m each, so every one survives the jitter filter.
const POINTS: TrackPoint[] = Array.from({ length: 700 }, (_, i) => ({
  lat: 9 + i * 0.002,
  lng: 77.3,
  at: new Date(Date.parse("2026-10-27T01:50:00.000Z") + i * 60_000).toISOString(),
}));

describe("splitTrips", () => {
  it("cuts the day into a morning and an evening trip once both have ended", () => {
    const trips = splitTrips(TIMELINE, STOPS, POINTS, new Date("2026-10-27T13:00:00.000Z"));
    expect(trips.map((t) => [t.label, t.start, t.end, t.running])).toEqual([
      ["Trip A", "2026-10-27T01:57:18.000Z", "2026-10-27T03:46:19.000Z", false],
      ["Trip B", "2026-10-27T10:43:25.000Z", "2026-10-27T12:06:55.000Z", false],
    ]);
    // The 14-minute stop stays inside Trip A, located from the vendor's stop list.
    expect(trips[0]!.stops).toEqual([
      { start: "2026-10-27T02:03:27.000Z", end: "2026-10-27T02:17:14.000Z", durationS: 827, address: "Gandhi Bazaar, Puliyangudi", lat: 9.17, lng: 77.39 },
    ]);
    expect(trips[0]!.from).toBe("Kadayanallur");
    expect(trips[0]!.to).toBe("Ilanji");
    expect(trips[1]!.stops).toEqual([]);
    expect(trips[0]!.points.length).toBeGreaterThan(1);
    expect(trips[0]!.distanceKm).toBeGreaterThan(0);
  });

  it("marks the evening trip running while the bus drives", () => {
    const trips = splitTrips(TIMELINE, STOPS, POINTS, new Date("2026-10-27T11:00:00.000Z"));
    expect(trips.map((t) => [t.label, t.running, t.end, t.to])).toEqual([
      ["Trip A", false, "2026-10-27T03:46:19.000Z", "Ilanji"],
      ["Trip B", true, null, null],
    ]);
  });

  it("keeps a trip running through a short stop that has not ended", () => {
    const trips = splitTrips(TIMELINE, STOPS, POINTS, new Date("2026-10-27T02:10:00.000Z"));
    expect(trips).toHaveLength(1);
    expect(trips[0]!.running).toBe(true);
    expect(trips[0]!.stops[0]).toMatchObject({ start: "2026-10-27T02:03:27.000Z", end: null });
  });

  it("ends the evening trip once the bus has been parked half an hour", () => {
    const parked20 = splitTrips(TIMELINE, STOPS, POINTS, new Date("2026-10-27T12:27:00.000Z"));
    expect(parked20[1]!.running).toBe(true);
    const parked40 = splitTrips(TIMELINE, STOPS, POINTS, new Date("2026-10-27T12:47:00.000Z"));
    expect(parked40[1]!.running).toBe(false);
  });

  it("finds no trips on a day the bus never moved", () => {
    expect(splitTrips([{ type: "STOP", start: "2026-10-26T18:30:00.000Z", end: null, address: null }], [], [], new Date("2026-10-27T05:00:00.000Z"))).toEqual([]);
  });
});

describe("findPauses", () => {
  // Bus 5965's morning trip on 27 Oct 2026, from the tracker (a point about every 20 s).
  const track = JSON.parse(readFileSync(new URL("./fixtures/bus-track-2026-10-27-morning.json", import.meta.url), "utf8")) as Array<TrackPoint & { speed: number }>;
  const from = Date.parse("2026-10-27T01:57:18.000Z");
  const to = Date.parse("2026-10-27T03:46:19.000Z");

  it("finds the long halts where children board", () => {
    const pauses = findPauses(track, from, to);
    // The 14-minute halt at 07:33 IST and the 7-minute one at 08:25 IST near Krishnapuram.
    const long = pauses.filter((p) => p.durationS >= 5 * 60);
    expect(long.map((p) => p.start)).toEqual(["2026-10-27T02:03:27.000Z", "2026-10-27T02:55:56.000Z"]);
    expect(long[1]!.lat).toBeCloseTo(9.092, 2);
    expect(long[1]!.lng).toBeCloseTo(77.3466, 2);
  });

  it("leaves out the trip's own start and end", () => {
    const pauses = findPauses(track, from, to);
    expect(pauses.every((p) => Date.parse(p.start) > from && Date.parse(p.end) < to)).toBe(true);
  });

  it("snaps a place to the nearest point of the track", () => {
    const hit = nearestPoint(track, { lat: 9.09207, lng: 77.3473 });
    expect(hit!.metres).toBeLessThan(200);
    expect(nearestPoint([], { lat: 0, lng: 0 })).toBeNull();
  });
});
