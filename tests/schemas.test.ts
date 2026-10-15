import { describe, expect, it } from "vitest";
import { busSchema, routeSchema, schoolTripSchema, studentSchema } from "@/lib/api/schemas/masters";
import { DEFAULT_SETTINGS, readSettings, settingsPatchSchema } from "@/lib/api/schemas/settings";
import { crewOpSchema } from "@/lib/api/schemas/crew";
import { phoneSchema } from "@/lib/api/schemas/auth";

describe("master payloads", () => {
  it("coerces form strings and treats empty references as unassigned", () => {
    const bus = busSchema.parse({ number: "12", registration: "ts 09 ub 1234", capacity: "42", driverId: "", routeId: "r1" });
    expect(bus).toEqual({ number: "12", registration: "TS 09 UB 1234", capacity: 42, driverId: null, attendantId: null, routeId: "r1" });
    expect(busSchema.safeParse({ number: "12", registration: "X", capacity: "0" }).success).toBe(false);
  });

  it("splits class and section and normalises the parent number", () => {
    const s = studentSchema.parse({ name: "Aarav", cls: "5 · b", parentName: "Rajesh", parentPhone: "+91 98490 21145" });
    expect(s.cls).toEqual({ grade: "Grade 5", section: "B" });
    expect(s.parentPhone).toBe("+919849021145");
    expect(studentSchema.safeParse({ name: "A", cls: "Grade 5", parentName: "R", parentPhone: "98490" }).success).toBe(false);
  });

  it("refuses the same stop twice on one route and parses times", () => {
    const ok = routeSchema.parse({
      name: "R", stops: [{ name: "A", pickup: "7:05 AM", drop: "4:44 PM" }, { name: "School", pickup: "07:50", drop: "15:48" }],
      distance: "11.4 km", duration: "45 min",
    });
    expect(ok.stops[0]).toMatchObject({ pickup: "07:05", drop: "16:44" });
    expect(ok.distance).toBe(11400);
    expect(ok.duration).toBe(2700);
    const dup = routeSchema.safeParse({ name: "R", stops: [{ name: "A", pickup: "7:00 AM", drop: "4:00 PM" }, { name: "a", pickup: "7:10 AM", drop: "4:10 PM" }] });
    expect(dup.success).toBe(false);
  });

  it("accepts the long date the trip form shows", () => {
    const t = schoolTripSchema.parse({
      name: "Zoo", destination: "Nehru Zoological Park", date: "20 October 2026", departTime: "8:00 AM",
      returnTime: "3:00 PM", teacherName: "Divya", fleet: [],
    });
    expect(t.date).toBe("2026-10-20");
  });
});

describe("settings", () => {
  it("fills defaults for rows written before a field existed", () => {
    expect(readSettings({ undoWindowMin: 15 }).retentionDays).toBe(DEFAULT_SETTINGS.retentionDays);
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("a partial update never carries defaults for fields not sent", () => {
    expect(settingsPatchSchema.parse({ undoWindowMin: 12 })).toEqual({ undoWindowMin: 12 });
  });
});

describe("auth and crew payloads", () => {
  it("takes a ten-digit mobile however it is typed", () => {
    expect(phoneSchema.parse("98480 12345")).toBe("9848012345");
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });

  it("validates queued crew events by type", () => {
    const base = { opId: "op-12345678", date: "2026-10-12", phase: "morning", at: "2026-10-12T02:00:00.000Z" };
    expect(crewOpSchema.safeParse({ ...base, type: "start" }).success).toBe(true);
    expect(crewOpSchema.safeParse({ ...base, type: "mark", studentId: "s1", markPhase: "board", status: "boarded", stopId: null }).success).toBe(false); // no clientMarkId
    expect(crewOpSchema.safeParse({ ...base, type: "teleport" }).success).toBe(false);
  });
});
