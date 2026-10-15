import "server-only";
import type { ZodType } from "zod";
import type { Ctx } from "@/server/http/handler";
import {
  attendantSchema,
  busSchema,
  driverSchema,
  routeSchema,
  schoolTripSchema,
  stopSchema,
  studentSchema,
} from "@/lib/api/schemas/masters";
import * as m from "./mutations";

/**
 * URL resource → its schema and writes. The generic routes under
 * src/app/api/admin/[resource] dispatch through this table, so every master
 * record gets the same create / update / delete behaviour.
 */

export interface Resource {
  schema: ZodType;
  create(ctx: Ctx, input: unknown): Promise<string | { id: string; [k: string]: unknown }>;
  update(ctx: Ctx, id: string, input: unknown): Promise<string>;
  remove(ctx: Ctx, id: string): Promise<void>;
}

/* Inputs arrive already parsed by `schema`; the casts restate that type. */
export const RESOURCES: Record<string, Resource> = {
  buses: {
    schema: busSchema,
    create: (ctx, i) => m.createBus(ctx, i as never),
    update: (ctx, id, i) => m.updateBus(ctx, id, i as never),
    remove: m.deleteBus,
  },
  students: {
    schema: studentSchema,
    create: (ctx, i) => m.createStudent(ctx, i as never),
    update: (ctx, id, i) => m.updateStudent(ctx, id, i as never),
    remove: m.deleteStudent,
  },
  drivers: {
    schema: driverSchema,
    create: (ctx, i) => m.createCrew(ctx, "DRIVER", i as never),
    update: (ctx, id, i) => m.updateCrew(ctx, "DRIVER", id, i as never),
    remove: (ctx, id) => m.deleteCrew(ctx, "DRIVER", id),
  },
  attendants: {
    schema: attendantSchema,
    create: (ctx, i) => m.createCrew(ctx, "ATTENDANT", i as never),
    update: (ctx, id, i) => m.updateCrew(ctx, "ATTENDANT", id, i as never),
    remove: (ctx, id) => m.deleteCrew(ctx, "ATTENDANT", id),
  },
  routes: {
    schema: routeSchema,
    create: (ctx, i) => m.createRoute(ctx, i as never),
    update: (ctx, id, i) => m.updateRoute(ctx, id, i as never),
    remove: m.deleteRoute,
  },
  stops: {
    schema: stopSchema,
    create: (ctx, i) => m.createStop(ctx, i as never),
    update: (ctx, id, i) => m.updateStop(ctx, id, i as never),
    remove: m.deleteStop,
  },
  "school-trips": {
    schema: schoolTripSchema,
    create: (ctx, i) => m.createSchoolTrip(ctx, i as never),
    update: (ctx, id, i) => m.updateSchoolTrip(ctx, id, i as never),
    remove: m.deleteSchoolTrip,
  },
};
