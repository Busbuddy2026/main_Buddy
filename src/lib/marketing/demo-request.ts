import { INTERESTS } from "@/lib/marketing/content";

/*
 * Demo request shape and validation.
 *
 * Shared by the form and by POST /api/demo-request, so the browser and the
 * server cannot disagree about what a valid request is. The server runs this
 * again on whatever arrives — the client copy is a courtesy, not a gate.
 */

export const DEMO_REQUEST_LIMITS = {
  name: 120,
  email: 200,
  school: 160,
  buses: 12,
  note: 2000,
} as const;

/** Deliberately loose: real addresses defeat clever patterns more often than
 *  they defeat "something, an @, something, a dot, something". */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface DemoRequestInput {
  name: string;
  email: string;
  school: string;
  buses: string;
  note: string;
  interests: string[];
}

export type DemoRequestField = keyof DemoRequestInput;
export type DemoRequestErrors = Partial<Record<DemoRequestField, string>>;

export type DemoRequestResult =
  | { ok: true; value: DemoRequestInput }
  | { ok: false; errors: DemoRequestErrors };

export const EMPTY_DEMO_REQUEST: DemoRequestInput = {
  name: "",
  email: "",
  school: "",
  buses: "",
  note: "",
  interests: [],
};

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

export function validateDemoRequest(raw: unknown): DemoRequestResult {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const value: DemoRequestInput = {
    name: text(source, "name"),
    email: text(source, "email"),
    school: text(source, "school"),
    buses: text(source, "buses"),
    note: text(source, "note"),
    // Anything not on the published list is dropped rather than rejected: a
    // stale tab should still be able to send its request.
    interests: Array.isArray(source.interests)
      ? [...new Set(source.interests.filter((i): i is string => typeof i === "string"))].filter(
          (i) => INTERESTS.includes(i),
        )
      : [],
  };

  const errors: DemoRequestErrors = {};

  if (!value.name) errors.name = "Please tell us your name";
  else if (value.name.length > DEMO_REQUEST_LIMITS.name) errors.name = "That name is too long";

  if (!EMAIL.test(value.email)) errors.email = "A valid work email, please";
  else if (value.email.length > DEMO_REQUEST_LIMITS.email)
    errors.email = "That address is too long";

  if (!value.school) errors.school = "Which school?";
  else if (value.school.length > DEMO_REQUEST_LIMITS.school)
    errors.school = "That name is too long";

  if (value.buses.length > DEMO_REQUEST_LIMITS.buses) errors.buses = "That does not look right";
  if (value.note.length > DEMO_REQUEST_LIMITS.note) errors.note = "Please keep this under 2000 characters";

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}
