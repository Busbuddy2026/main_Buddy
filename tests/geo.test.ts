import { describe, expect, it } from "vitest";
import { delayMinutes, distanceM, etaMinutes, localMinutes, nextStop } from "@/lib/geo";

const stops = [
  { id: "a", name: "Kondapur", lat: 17.4615, lng: 78.3637, time: "07:05" },
  { id: "b", name: "Botanical", lat: 17.4573, lng: 78.3582, time: "07:15" },
  { id: "c", name: "School", lat: 17.4302, lng: 78.3401, time: "07:50" },
];

describe("geometry", () => {
  it("measures distance", () => {
    const d = distanceM(stops[0]!, stops[2]!);
    expect(d).toBeGreaterThan(3_800);
    expect(d).toBeLessThan(4_400);
    expect(distanceM(stops[0]!, stops[0]!)).toBe(0);
  });

  it("estimates arrival, never faster than city traffic allows", () => {
    expect(etaMinutes(5_000, 30)).toBe(10);
    expect(etaMinutes(5_000, 0)).toBe(20); // floored at 15 km/h
  });

  it("heads for the next stop once at a stop", () => {
    expect(nextStop({ lat: 17.4614, lng: 78.3636 }, stops)?.stop.id).toBe("b"); // at Kondapur
    expect(nextStop({ lat: 17.45, lng: 78.352 }, stops)?.stop.id).toBe("b"); // between, nearer Botanical
    expect(nextStop({ lat: 17.4302, lng: 78.3401 }, stops)?.stop.id).toBe("c"); // at the last stop
    expect(nextStop({ lat: 0, lng: 0 }, [])).toBeNull();
  });

  it("computes lateness against the stop's schedule", () => {
    expect(delayMinutes(7 * 60 + 10, 12, "07:15")).toBe(7);
    expect(delayMinutes(7 * 60, 5, "07:15")).toBe(0);
    expect(localMinutes(new Date("2026-10-12T01:42:00Z"))).toBe(7 * 60 + 12);
  });
});
