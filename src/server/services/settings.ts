import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Tx } from "@/server/db";
import type { Ctx } from "@/server/http/handler";
import { conflict, notFound } from "@/server/http/errors";
import { hashSecret } from "@/server/auth/crypto";
import { readSettings, settingsPatchSchema } from "@/lib/api/schemas/settings";

/** School profile, operating rules and the console's staff accounts. */

export async function loadSettings(db: Tx, schoolId: string) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  return {
    profile: { name: school.name, phone: school.phone ?? "", timezone: school.timezone },
    settings: readSettings(school.settings),
  };
}

export const settingsUpdateSchema = z.object({
  profile: z
    .object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(30),
    })
    .partial()
    .optional(),
  settings: settingsPatchSchema.optional(),
});

export async function updateSettings(ctx: Ctx, input: z.infer<typeof settingsUpdateSchema>) {
  const school = await ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId } });
  const current = readSettings(school.settings);
  const patch = Object.fromEntries(Object.entries(input.settings ?? {}).filter(([, v]) => v !== undefined));
  // Keys outside the settings form (the analytics PIN hash) are kept as they are.
  const next = { ...((school.settings ?? {}) as Record<string, unknown>), ...current, ...patch };
  await ctx.db.school.update({
    where: { id: ctx.schoolId },
    data: {
      ...(input.profile?.name ? { name: input.profile.name } : {}),
      ...(input.profile?.phone !== undefined ? { phone: input.profile.phone || null } : {}),
      settings: next,
    },
  });
  const changed = Object.keys(patch).concat(Object.keys(input.profile ?? {}).map((k) => `profile.${k}`));
  ctx.audit({ action: "UPDATE_SETTINGS", entityType: "School", entityId: ctx.schoolId, meta: { changed: changed.join(",") } });
  return loadSettings(ctx.db, ctx.schoolId);
}

// ── Staff accounts ────────────────────────────────────────────────────────

const ROLES = ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF", "VIEWER"] as const;

export async function listUsers(db: Tx, schoolId: string) {
  const users = await db.adminUser.findMany({ where: { schoolId }, orderBy: [{ deletedAt: "asc" }, { name: "asc" }] });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    active: !u.deletedAt,
    lastLogin: u.lastLoginAt?.toISOString() ?? null,
  }));
}

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "Use 3–40 letters, numbers, dots, dashes or underscores."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  role: z.enum(ROLES),
});

export const userUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

/** Creates the account with the username and password the super admin chose. */
export async function createUser(ctx: Ctx, input: z.infer<typeof userCreateSchema>) {
  // Usernames are unique across schools: the sign-in form has no school picker.
  const taken = await ctx.db.adminUser.findUnique({ where: { username: input.username } });
  if (taken) throw conflict("That username is taken.", { username: "Already in use." });
  const user = await ctx.db.adminUser.create({
    data: {
      schoolId: ctx.schoolId,
      name: input.name,
      username: input.username,
      role: input.role,
      passwordHash: await hashSecret(input.password),
    },
  });
  ctx.audit({ action: "CREATE_ADMIN_USER", entityType: "AdminUser", entityId: user.id, meta: { role: input.role } });
  return { id: user.id };
}

/** Replaces a staff password with a one-time one and signs them out everywhere. */
export async function resetUserPassword(ctx: Ctx, id: string) {
  const user = await ctx.db.adminUser.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!user) throw notFound("User");
  const password = randomBytes(9).toString("base64url");
  await ctx.db.adminUser.update({ where: { id }, data: { passwordHash: await hashSecret(password) } });
  await ctx.db.session.updateMany({ where: { actorId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  ctx.audit({ action: "RESET_ADMIN_PASSWORD", entityType: "AdminUser", entityId: id });
  return { password };
}

export async function updateUser(ctx: Ctx, id: string, input: z.infer<typeof userUpdateSchema>) {
  const user = await ctx.db.adminUser.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!user) throw notFound("User");
  if (id === ctx.actor.id && (input.active === false || (input.role && input.role !== user.role))) {
    throw conflict("You cannot change your own role or deactivate yourself.");
  }
  // Keep at least one active super admin.
  if (user.role === "SUPER_ADMIN" && (input.active === false || (input.role && input.role !== "SUPER_ADMIN"))) {
    const others = await ctx.db.adminUser.count({ where: { schoolId: ctx.schoolId, role: "SUPER_ADMIN", deletedAt: null, id: { not: id } } });
    if (!others) throw conflict("The school needs at least one super admin.");
  }
  await ctx.db.adminUser.update({
    where: { id },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.active === false ? { deletedAt: new Date() } : input.active === true ? { deletedAt: null } : {}),
    },
  });
  if (input.active === false || input.role) {
    // New permissions take effect at the next sign-in.
    await ctx.db.session.updateMany({ where: { actorId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  ctx.audit({ action: "UPDATE_ADMIN_USER", entityType: "AdminUser", entityId: id, meta: { role: input.role ?? null, active: input.active ?? null } });
}
