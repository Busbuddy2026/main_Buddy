import { z } from "zod";
import { route } from "@/server/http/handler";
import type { ParentPrefs } from "@/lib/api/types";

const prefsPatch = z
  .object({ alerts: z.boolean(), absence: z.boolean(), digest: z.boolean() })
  .partial();

/** PATCH /api/parent/preferences: which notifications this guardian receives. */
export const PATCH = route({ app: "parent", body: prefsPatch }, async ({ body, ctx }) => {
  const guardian = await ctx.db.guardian.findFirstOrThrow({
    where: { id: ctx.actor.id, schoolId: ctx.schoolId },
    select: { prefs: true },
  });
  const prefs = { ...(guardian.prefs as Partial<ParentPrefs>), ...body };
  await ctx.db.guardian.update({ where: { id: ctx.actor.id }, data: { prefs } });
  ctx.audit({ action: "UPDATE_PREFERENCES", entityType: "Guardian", entityId: ctx.actor.id, meta: body });
  return prefs;
});
