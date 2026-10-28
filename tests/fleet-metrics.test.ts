import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  afterHoursSpans,
  distanceToLineM,
  driverScore,
  estimateFuel,
  hotspots,
  idleSeconds,
  idleSpells,
  median,
  offRouteSpans,
  overspeedPoints,
  type MetricPoint,
} from "@/lib/fleet-metrics";

// Bus 5965 on 27 Oct 2026, the whole day from the tracker (a point about every 20 s).
const day = JSON.parse(readFileSync(new URL("./fixtures/bus-track-2026-10-27-day.json", import.meta.url), "utf8")) as MetricPoint[];
const WINDOWS = [
  { start: "06:30", end: "09:30" },
  { start: "15:30", end: "18:00" },
];

describe("idling", () => {
  it("matches LivePin's idle total for the day", () => {
    // LivePin's report: 2438 s idle.
    expect(Math.abs(idleSeconds(day) - 2438)).toBeLessThan(120);
  });

  it("finds the long engine-on waits, with where and when", () => {
    const spells = idleSpells(day, 300);
    expect(spells.map((s) => [s.start, Math.round(s.durationS / 60)])).toEqual([
      // 8:25 IST at Krishnapuram, 16:13 IST at school.
      ["2026-10-27T02:55:56.000Z", 8],
      ["2026-10-27T10:43:25.000Z", 9],
    ]);
    expect(spells[0]!.lat).toBeCloseTo(9.092, 2);
  });
});

describe("estimateFuel", () => {
  it("adds driving and idling, at the given mileage and price", () => {
    const f = estimateFuel({ km: 76.8, idleS: 2438, mileageKmpl: 5, idleLph: 2.5, dieselPriceRs: 95 });
    // 15.36 L driving + 1.69 L idling.
    expect(f.litres).toBe(17.1);
    expect(f.idleLitres).toBe(1.7);
    expect(f.costRs).toBe(1620);
    expect(f.idleCostRs).toBe(161);
  });
});

describe("afterHoursSpans", () => {
  it("finds nothing on a normal school day", () => {
    expect(afterHoursSpans(day, WINDOWS)).toEqual([]);
  });

  it("flags driving outside the windows", () => {
    // Narrow windows: the evening run (16:13–17:36 IST) falls outside.
    const spans = afterHoursSpans(day, [{ start: "07:00", end: "09:00" }], 0);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.some((s) => s.km > 10)).toBe(true);
  });
});

describe("offRouteSpans", () => {
  const route = day.filter((p) => p.at < "2026-10-27T03:47:00.000Z" && p.speed > 5).map((p) => ({ lat: p.lat, lng: p.lng }));

  it("finds no detour when the bus follows its own route", () => {
    const morning = day.filter((p) => p.at < "2026-10-27T03:47:00.000Z");
    expect(offRouteSpans(morning, route, WINDOWS)).toEqual([]);
  });

  it("flags driving far from the route", () => {
    const shifted = day.filter((p) => p.at < "2026-10-27T03:47:00.000Z").map((p) => ({ ...p, lat: p.lat + 0.02 }));
    const spans = offRouteSpans(shifted, route, WINDOWS);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0]!.maxM).toBeGreaterThan(500);
  });

  it("measures distance to a line", () => {
    const line = [{ lat: 9, lng: 77 }, { lat: 9, lng: 77.01 }];
    expect(distanceToLineM({ lat: 9.001, lng: 77.005 }, line)).toBeGreaterThan(100);
    expect(distanceToLineM({ lat: 9.001, lng: 77.005 }, line)).toBeLessThan(120);
  });
});

describe("overspeed", () => {
  it("keeps at most one point a minute above the limit, and groups them", () => {
    const pts = overspeedPoints(day, 50);
    for (let i = 1; i < pts.length; i++) expect(Date.parse(pts[i]!.at) - Date.parse(pts[i - 1]!.at)).toBeGreaterThanOrEqual(60_000);
    const spots = hotspots(pts);
    expect(spots.reduce((n, s) => n + s.count, 0)).toBe(pts.length);
    expect(spots[0]!.count).toBeGreaterThanOrEqual(spots[spots.length - 1]!.count);
  });
});

describe("median and driverScore", () => {
  it("takes the middle", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBeNull();
  });

  it("scores a clean driver 100 and penalises per day driven", () => {
    const clean = { days: 10, overspeedEvents: 0, harshEvents: 0, idleMin: 0, missedStops: 0, afterHoursTrips: 0, offRouteSpans: 0 };
    expect(driverScore(clean)).toBe(100);
    const risky = { ...clean, overspeedEvents: 20, afterHoursTrips: 2 };
    expect(driverScore(risky)).toBeLessThan(60);
    // Same habits over twice the days: the same score.
    expect(driverScore({ ...risky, days: 20, overspeedEvents: 40, afterHoursTrips: 4 })).toBe(driverScore(risky));
  });
});
