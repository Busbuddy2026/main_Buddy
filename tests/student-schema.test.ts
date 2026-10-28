import { describe, expect, it } from "vitest";
import { studentSchema } from "@/lib/api/schemas/masters";

const base = { name: "P. Sri Pavithra", cls: "XI · BMM", roll: "STU-001", busId: "", routeId: "", stopId: "" };

describe("studentSchema", () => {
  it("takes a student with no parent account, keeping an unverified contact", () => {
    const r = studentSchema.parse({ ...base, parentName: "", parentPhone: "—", contactPhone: "6385671476" });
    expect(r.parentName).toBeUndefined();
    expect(r.parentPhone).toBeUndefined();
    expect(r.contactPhone).toBe("+916385671476");
    expect(r.cls).toEqual({ grade: "XI", section: "BMM" });
  });

  it("needs both the parent's name and mobile, or neither", () => {
    expect(studentSchema.safeParse({ ...base, parentName: "Lakshmi" }).success).toBe(false);
    expect(studentSchema.safeParse({ ...base, parentPhone: "9848012345" }).success).toBe(false);
    expect(studentSchema.parse({ ...base, parentName: "Lakshmi", parentPhone: "+91 98480 12345" }).parentPhone).toBe("+919848012345");
  });

  it("rejects a contact number that is not a mobile", () => {
    expect(studentSchema.safeParse({ ...base, contactPhone: "12345" }).success).toBe(false);
  });
});
