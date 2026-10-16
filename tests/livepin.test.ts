import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFleet, parseStreamUrls, playerUrl } from "@/server/vendors/livepin";
import { parseDelivery, secretMatches } from "@/server/services/tracking-webhook";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/livepin-v2-vehicles.json", import.meta.url), "utf8"));

describe("LivePin fleet parsing", () => {
  const fleet = parseFleet(fixture);

  it("keeps the vehicles it can read and skips malformed ones", () => {
    expect(fleet).toHaveLength(2);
    const [cam, gpsOnly] = fleet;
    expect(cam).toMatchObject({ vehicleNo: "TEST 01 AB 1234", dashcamChannels: 2, status: "NO_DATA" });
    expect(cam!.fix).toMatchObject({ lat: 13.196475, lng: 79.00188, speed: 46, heading: 292, ignition: true });
    expect(cam!.fix!.at).toBeInstanceOf(Date);
    expect(gpsOnly).toMatchObject({ dashcamChannels: 0, fix: null });
  });

  it("never carries the vendor's account records", () => {
    const text = JSON.stringify(fleet);
    expect(text).not.toMatch(/password|owner@example\.com|FAKE OWNER|fcm/i);
  });

  it("lists only alarms that are on", () => {
    expect(fleet[0]!.fix!.alarms).toEqual([]);
    const on = structuredClone(fixture);
    on.data[0].location_data.alarm.emergency = true;
    on.data[0].location_data.alarm.overspeed = true;
    expect(parseFleet(on)[0]!.fix!.alarms.sort()).toEqual(["emergency", "overspeed"]);
  });
});

describe("dashcam stream", () => {
  it("finds FLV URLs wherever the response puts them", () => {
    expect(parseStreamUrls({ data: { channel_1: "https://v.example/live/1.flv?t=a", channel_2: "https://v.example/live/2.flv?t=b", note: "ok" } }))
      .toEqual(["https://v.example/live/1.flv?t=a", "https://v.example/live/2.flv?t=b"]);
    expect(parseStreamUrls(["https://v.example/a.flv", "https://v.example/a.flv"])).toHaveLength(1);
    expect(parseStreamUrls({ url: "https://v.example/stream/1" })).toEqual(["https://v.example/stream/1"]);
    expect(parseStreamUrls({ error: "nope" })).toEqual([]);
  });

  it("builds the player link with each URL encoded", () => {
    expect(playerUrl(["https://v/1.flv?a=1&b=2", "https://v/2.flv"])).toBe(
      "https://livepin.in/player_v2.html?urls=https%3A%2F%2Fv%2F1.flv%3Fa%3D1%26b%3D2,https%3A%2F%2Fv%2F2.flv",
    );
  });
});

describe("webhook", () => {
  it("checks the shared secret exactly", () => {
    expect(secretMatches("s3cret", "s3cret")).toBe(true);
    expect(secretMatches("s3creT", "s3cret")).toBe(false);
    expect(secretMatches("s3cre", "s3cret")).toBe(false);
    expect(secretMatches(null, "s3cret")).toBe(false);
    expect(secretMatches("x", undefined)).toBe(false);
  });

  it("reads the event from the wrapped delivery", () => {
    const event = { notification: { notification_type: "sos", imei: "000000000001", timestamp: 1, location: { latitude: 13.1, longitude: 79.0 } } };
    expect(parseDelivery({ body: JSON.stringify(event), method: "POST" })).toMatchObject({ notification_type: "sos", imei: "000000000001" });
    expect(parseDelivery(event)).toMatchObject({ notification_type: "sos" });
    expect(parseDelivery({ body: "not json" })).toBeNull();
  });
});
