import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, toApiError } from "@/server/http/errors";

describe("error envelope", () => {
  it("maps validation errors to field messages", () => {
    const r = z.object({ name: z.string().min(1, "Enter the name."), stops: z.array(z.object({ time: z.string().min(1, "Time?") })) })
      .safeParse({ name: "", stops: [{ time: "" }] });
    const api = toApiError(r.error);
    expect(api.code).toBe("VALIDATION");
    expect(api.status).toBe(400);
    expect(api.fields).toEqual({ name: "Enter the name.", "stops.0.time": "Time?" });
  });

  it("keeps an ApiError and hides anything unexpected", () => {
    expect(toApiError(new ApiError("WRONG_APP", "x")).status).toBe(403);
    const hidden = toApiError(new Error("database password is hunter2"));
    expect(hidden.code).toBe("INTERNAL");
    expect(hidden.message).not.toContain("hunter2");
  });
});
