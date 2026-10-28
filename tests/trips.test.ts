import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coordsFromText } from "@/lib/location";
import { findPauses, nearestPoint, splitTrips, stopVisits, type TimelinePeriod, type TrackPoint } from "@/lib/trips";

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

describe("stopVisits", () => {
  const track = JSON.parse(readFileSync(new URL("./fixtures/bus-track-2026-10-27-morning.json", import.meta.url), "utf8")) as Array<TrackPoint & { speed: number }>;
  const from = Date.parse("2026-10-27T01:57:18.000Z");
  const to = Date.parse("2026-10-27T03:46:19.000Z");
  const pins = [
    // Where it halted 8 minutes at 8:25 IST.
    { id: "halt", name: "Krishnapuram Malampettai", seq: 1, lat: 9.09203, lng: 77.34656 },
    // Halfway between two fixes 240 m apart, at over 30 km/h: driven past, never slowed.
    { id: "road", name: "Roadside", seq: 2, lat: 9.07607, lng: 77.34584 },
    // Two kilometres off the road.
    { id: "away", name: "Elsewhere", seq: 3, lat: 9.1, lng: 77.3 },
  ];

  it("tells stopped, passed and missed apart", () => {
    const v = stopVisits(track, pins, from, to, false);
    expect(v.map((x) => [x.stopId, x.status])).toEqual([["halt", "stopped"], ["road", "passed"], ["away", "missed"]]);
    expect(v[0]!.dwellS).toBeGreaterThan(5 * 60);
    // Interpolated between 08:40:26 and 08:40:49 IST.
    expect(v[1]!.at! > "2026-10-27T03:10:26.000Z" && v[1]!.at! < "2026-10-27T03:10:49.000Z").toBe(true);
    expect(v[2]!.at).toBeNull();
  });

  it("does not judge stops a running trip has not reached yet", () => {
    const early = stopVisits(track, pins, from, Date.parse("2026-10-27T03:00:00.000Z"), true);
    expect(early.map((x) => x.stopId)).toEqual(["halt"]);
  });

  it("waits on the stop a running trip has just reached", () => {
    // Just past the roadside pin: it is the latest stop reached, so it is not judged yet.
    const now = stopVisits(track, pins, from, Date.parse("2026-10-27T03:11:00.000Z"), true);
    expect(now.map((x) => [x.stopId, x.status])).toEqual([["halt", "stopped"]]);
  });
});

describe("coordsFromText", () => {
  it("reads coordinates and Google Maps links", () => {
    expect(coordsFromText("9.18129, 77.39932")).toEqual({ lat: 9.18129, lng: 77.39932 });
    expect(coordsFromText("https://www.google.com/maps/place/Puliyangudi+Bus+Stand/@9.1812,77.3990,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d9.1812934!4d77.3993201")).toEqual({ lat: 9.181293, lng: 77.39932 });
    expect(coordsFromText("https://www.google.com/maps/@9.1812,77.399,15z")).toEqual({ lat: 9.1812, lng: 77.399 });
    expect(coordsFromText("https://maps.google.com/?q=9.18129,77.39932")).toEqual({ lat: 9.18129, lng: 77.39932 });
    expect(coordsFromText("https://www.google.com/maps/search/9.18129,+77.39932")).toEqual({ lat: 9.18129, lng: 77.39932 });
  });

  it("finds nothing in a search link or nonsense", () => {
    expect(coordsFromText("https://www.google.com/search?q=%E0%AE%AA%E0%AF%81%E0%AE%B3&kgmid=/g/11sjdvpfwd")).toBeNull();
    expect(coordsFromText("95.1, 77.3")).toBeNull();
    expect(coordsFromText("Puliyangudi Bus Stand")).toBeNull();
  });
});

describe("short moves", () => {
  it("are not trips, and the trips after them keep their letters in order", () => {
    // A 300 m shuffle in the school yard between the morning and evening runs.
    const timeline: TimelinePeriod[] = [
      { type: "STOP", start: "2026-10-28T00:00:00.000Z", end: "2026-10-28T02:00:00.000Z", address: "Depot" },
      { type: "MOVE", start: "2026-10-28T02:00:00.000Z", end: "2026-10-28T03:00:00.000Z", address: null },
      { type: "STOP", start: "2026-10-28T03:00:00.000Z", end: "2026-10-28T05:28:00.000Z", address: "School" },
      { type: "MOVE", start: "2026-10-28T05:28:00.000Z", end: "2026-10-28T05:36:00.000Z", address: null },
      { type: "STOP", start: "2026-10-28T05:36:00.000Z", end: "2026-10-28T10:00:00.000Z", address: "School" },
      { type: "MOVE", start: "2026-10-28T10:00:00.000Z", end: "2026-10-28T11:00:00.000Z", address: null },
      { type: "STOP", start: "2026-10-28T11:00:00.000Z", end: null, address: "Depot" },
    ];
    const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 28, h, m)).toISOString();
    const points: TrackPoint[] = [
      // Morning: 6 km north over an hour.
      ...Array.from({ length: 61 }, (_, i) => ({ lat: 9 + i * 0.001, lng: 77.3, at: at(2, i) })),
      // Yard shuffle: 300 m over 8 minutes.
      ...Array.from({ length: 9 }, (_, i) => ({ lat: 9.06 + i * 0.00034, lng: 77.3, at: at(5, 28 + i) })),
      // Evening: 6 km back.
      ...Array.from({ length: 61 }, (_, i) => ({ lat: 9.06 - i * 0.001, lng: 77.3, at: at(10, i) })),
    ];
    const trips = splitTrips(timeline, [], points, new Date("2026-10-28T12:00:00.000Z"));
    expect(trips.map((t) => [t.label, t.start])).toEqual([
      ["Trip A", "2026-10-28T02:00:00.000Z"],
      ["Trip B", "2026-10-28T10:00:00.000Z"],
    ]);
  });
});
