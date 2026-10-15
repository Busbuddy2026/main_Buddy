import { describe, expect, it } from "vitest";
import { overlay } from "@/lib/transport/crew-store";
import type { CrewOp, PhasePlan } from "@/lib/api/schemas/crew";

const plan: PhasePlan = {
  status: "NOT_STARTED",
  stops: [{ key: "s1", name: "Botanical Garden", short: "Botanical", time: "7:15 AM" }],
  marks: {},
  students: [],
  sos: false,
};
const base = { date: "2026-10-12", phase: "morning" as const, at: "2026-10-12T02:00:00.000Z" };

describe("queued events over the cached plan", () => {
  it("shows a mark taken offline, and an undo removes it", () => {
    const ops: CrewOp[] = [
      { ...base, opId: "o1", type: "mark", clientMarkId: "c1", studentId: "aarav", markPhase: "board", status: "boarded", stopId: "s1" },
    ];
    const marked = overlay(plan, ops, "2026-10-12", "morning", plan.stops);
    expect(marked.status).toBe("ACTIVE");
    expect(marked.marks["board:aarav"]).toMatchObject({ status: "boarded", short: "Botanical" });

    const undone = overlay(plan, [...ops, { ...base, opId: "o2", type: "undo", studentId: "aarav", markPhase: "board" }], "2026-10-12", "morning", plan.stops);
    expect(undone.marks["board:aarav"]).toBeUndefined();
  });

  it("ignores events for another day or trip", () => {
    const ops: CrewOp[] = [{ ...base, opId: "o1", type: "sos", active: true, phase: "evening" }];
    expect(overlay(plan, ops, "2026-10-12", "morning", plan.stops).sos).toBe(false);
    expect(overlay(plan, ops, "2026-10-12", "evening", plan.stops).sos).toBe(true);
    expect(overlay(plan, ops, "2026-10-13", "evening", plan.stops).sos).toBe(false);
  });
});
