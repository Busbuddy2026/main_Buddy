import { describe, expect, it } from "vitest";
import { addDays, clockLabel, dbDate, dayOf, formatTime, localDate, parseClock } from "@/lib/time";

describe("school time", () => {
  it("uses the school's calendar date, not UTC's", () => {
    // 20:00 UTC is already the next morning in India.
    expect(localDate(new Date("2026-10-12T20:00:00Z"))).toBe("2026-10-13");
    expect(localDate(new Date("2026-10-12T10:00:00Z"))).toBe("2026-10-12");
  });

  it("round-trips calendar days through the database type", () => {
    expect(dayOf(dbDate("2026-02-28"))).toBe("2026-02-28");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("parses and prints clock times", () => {
    expect(parseClock("7:24 AM")).toBe("07:24");
    expect(parseClock("12:05 AM")).toBe("00:05");
    expect(parseClock("12:30 pm")).toBe("12:30");
    expect(parseClock("4:20 PM")).toBe("16:20");
    expect(parseClock("16:20")).toBe("16:20");
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("13:00 PM")).toBeNull();
    expect(clockLabel("07:05")).toBe("7:05 AM");
    expect(clockLabel("15:48")).toBe("3:48 PM");
    expect(clockLabel("00:10")).toBe("12:10 AM");
  });

  it("renders instants in IST", () => {
    expect(formatTime(new Date("2026-10-12T01:42:00Z"))).toBe("7:12 AM");
  });
});
