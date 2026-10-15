/**
 * Response shapes shared by the server (services, mappers) and the browser
 * (stores). Anything the API returns is typed here, so a change on one side
 * fails the build on the other.
 */

export type AdminRole = "SUPER_ADMIN" | "TRANSPORT_MANAGER" | "OFFICE_STAFF" | "VIEWER";

export interface AdminMe {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  role: AdminRole;
  roleTitle: string;
  school: { name: string; phone: string | null };
}

export interface ParentChild {
  id: string;
  first: string;
  name: string;
  initial: string;
  cls: string;
  roll: string;
  bus: string;
  stop: string;
}

export interface ParentPrefs {
  alerts: boolean;
  absence: boolean;
  digest: boolean;
}

export interface ParentMe {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  /** Ten digits, no country code. */
  phone: string;
  prefs: ParentPrefs;
  children: ParentChild[];
}

export interface CrewMe {
  id: string;
  name: string;
  initials: string;
  role: string;
  crewId: string;
  phone: string;
  bus: { id: string; label: string; reg: string; route: string | null } | null;
  /** The driver, for an attendant; the attendant, for a driver. */
  partner: { name: string; initials: string; phone: string } | null;
}
