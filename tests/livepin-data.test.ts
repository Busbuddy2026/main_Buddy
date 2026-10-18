import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAlerts, parseDayReport, parseHistory, parseLocation } from "@/server/vendors/livepin";
import { mask, open, seal } from "@/server/crypto/secret-box";
import { FEED_RULES } from "@/server/services/tracking";

const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("LivePin live location", () => {
  const loc = parseLocation(read("livepin-location.json"))!;

  it("reads position, motion, status and sensors", () => {
    expect(loc).toMatchObject({ lat: 13.193332, lng: 80.27794, altitude: 17, speed: 0, heading: 178, ignition: false, status: "PARKED" });
    expect(loc.address).toMatch(/Chennai/);
    expect(loc.statusSince).toBeInstanceOf(Date);
    expect(loc.sensors).toMatchObject({ gpsLock: true, load: "EMPTY", circuitConnected: true, doorLocked: false });
    expect(loc.sensors.doors).toEqual({ front: false, middle: false, back: false, driver: false }); // all closed
    expect(loc.alarms).toContain("terminal_main_power_undervoltage");
  });

  it("drops device, vehicle and driver records", () => {
    expect(JSON.stringify(loc)).not.toMatch(/FAKE DRIVER|example\.com|\+910000000000/);
  });
});

describe("LivePin daily report", () => {
  const r = parseDayReport(read("livepin-report.json"))!;

  it("converts distance and keeps durations in seconds", () => {
    expect(r.distanceKm).toBe(152.3);
    expect(r).toMatchObject({ moving: 27322, engineOn: 10180, idle: 3693, parked: 55384, maxSpeed: 50, avgSpeed: 26, overspeedLimit: 60 });
  });

  it("maps stops, timeline, ignition and geofence events", () => {
    expect(r.stops[0]).toMatchObject({ address: expect.stringMatching(/Chennai/), at: { lat: 13.193385, lng: 80.27795 } });
    expect(r.timeline[0]).toMatchObject({ type: "STOP", durationS: 45440 });
    expect(r.ignition[0]).toMatchObject({ state: "ON" });
    expect(r.geofence[0]).toMatchObject({ event: "ENTER" });
  });

  it("returns null for something that is not a report", () => {
    expect(parseDayReport({ error: "x" })).toBeNull();
  });
});

describe("LivePin alerts and history", () => {
  it("keeps readable alerts with a stable id", () => {
    const alerts = parseAlerts(read("livepin-alerts.json"));
    expect(alerts).toHaveLength(5);
    expect(alerts[0]!.externalId).toMatch(/^livepin:/);
    expect(alerts[0]).toMatchObject({ type: "main_power_undervoltage", priority: "high" });
  });

  it("sorts the track and finds the latest health readings", () => {
    const h = parseHistory({
      location_records: [
        { latitude: 1, longitude: 2, timestamp: 2000, satellites: null, gsm_signal_strength: 18 },
        { latitude: 1, longitude: 2, timestamp: 1000, satellites: 9, external_voltage: 12.4 },
        { latitude: null, longitude: 2, timestamp: 3000 },
      ],
    });
    expect(h.points.map((p) => +p.at)).toEqual([1000, 2000]);
    expect(h.health).toMatchObject({ satellites: 9, gsmSignal: 18, externalVoltage: 12.4 });
  });
});

describe("alerts that open incidents", () => {
  it("follows the agreed mapping", () => {
    expect(FEED_RULES.sos).toMatchObject({ severity: "CRITICAL", notify: true });
    expect(FEED_RULES.main_power_off).toMatchObject({ severity: "HIGH" });
    expect(FEED_RULES.wire_disconnect).toMatchObject({ severity: "HIGH" });
    expect(FEED_RULES.overspeed).toMatchObject({ severity: "LOW" });
    expect(FEED_RULES.user_defined_alarm).toMatchObject({ severity: "LOW" });
    expect(FEED_RULES.engine_status).toBeUndefined();
    expect(FEED_RULES.storage_failure).toBeUndefined();
  });
});

describe("secret box", () => {
  const key = Buffer.alloc(32, 7);

  it("round-trips and never stores the plain secret", () => {
    const sealed = seal("tn0-secret-value", key);
    expect(sealed).not.toContain("tn0-secret-value");
    expect(open(sealed, key)).toBe("tn0-secret-value");
    expect(seal("same", key)).not.toBe(seal("same", key));
    expect(mask("abcdefgh")).toBe("••••efgh");
  });

  it("rejects tampering and the wrong key", () => {
    const sealed = seal("secret", key);
    const parts = sealed.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => open(parts.join(":"), key)).toThrow();
    expect(() => open(sealed, Buffer.alloc(32, 8))).toThrow();
  });
});
