/**
 * Seed one school with the prototype's data (AGENTS.md: keep the same names so
 * screenshots and specs line up): 6 buses, 4 routes, 15 stops, 8 students,
 * 5 drivers, 4 attendants, 3 school trips. On top of that, two school weeks of
 * completed trips with attendance marks, so history and analytics have real
 * rows to aggregate, and today's morning run already underway on Bus 08 and
 * Bus 21. Bus 12 is left for the crew app demo.
 *
 * Demo data only. It goes into the test database (DATABASE_URL_TEST), never
 * the real one: `npm run db:seed:demo` runs it through scripts/test-db.mjs,
 * and it refuses to run any other way. The real database gets prisma/seed.ts.
 *
 * Demo sign-ins:
 *   admin   transport / demo1234
 *   parent  98480 12345, OTP shown on screen when DEV_ECHO_SECRETS=1
 *   crew    GF-ATT-0142 / 1234 (every crew member's PIN is 1234)
 *
 * Prepare the test database with `npm run db:test:deploy`, then
 * `npm run db:seed:demo`. Refuses to run twice against the same database.
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MarkStatus, type Prisma, type TripPhase } from "../src/generated/prisma/client";
import { hashSecret } from "../src/server/auth/crypto";
import { addDays, dbDate, localDate } from "../src/lib/time";
import { DEFAULT_SETTINGS } from "../src/lib/api/schemas/settings";

config({ path: ".env.local", quiet: true });

if (process.env.GF_TEST_DB !== "1") {
  throw new Error("The demo seed only runs against the test database: use `npm run db:seed:demo`.");
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env.local before seeding.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const say = (line: string) => process.stdout.write(`${line}\n`);

/** "+91 98490 21145" → "+919849021145" */
const e164 = (phone: string) => phone.replace(/[^\d+]/g, "");

/** "1.2 MB" / "640 KB" → bytes */
function bytes(size: string): number {
  const [n, unit] = size.split(" ");
  return Math.round(Number(n) * (unit === "MB" ? 1_048_576 : 1024));
}

/** "14 Mar 2027" → Date, "—" → null */
function day(label: string): Date | null {
  if (!label || label === "—") return null;
  const d = new Date(`${label} 00:00:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Deterministic PRNG, so every seed produces the same history. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** "07:24" + minutes, on a given local day in IST → UTC instant. */
function at(dayStr: string, hhmm: string, plusMin = 0): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const utc = new Date(`${dayStr}T00:00:00.000Z`);
  utc.setUTCMinutes(h * 60 + m + plusMin - 330); // IST is UTC+5:30
  return utc;
}

async function main() {
  const existing = await db.school.findFirst({ where: { name: "Bharath Vidya Mandir" } });
  if (existing) {
    say("Already seeded: Bharath Vidya Mandir exists. Run `npm run db:reset` to start over.");
    return;
  }

  const pin = await hashSecret("1234");

  const school = await db.school.create({
    data: {
      name: "Bharath Vidya Mandir",
      phone: "+91 40 2311 4500",
      timezone: "Asia/Kolkata",
      settings: DEFAULT_SETTINGS,
    },
  });
  const schoolId = school.id;

  // ── Admins ────────────────────────────────────────────────────────────────
  await db.adminUser.createMany({
    data: [
      {
        schoolId,
        username: "transport",
        name: "Arumugam K.",
        role: "TRANSPORT_MANAGER",
        passwordHash: await hashSecret("demo1234"),
      },
      {
        schoolId,
        username: "principal",
        name: "Lakshmi Iyer",
        role: "SUPER_ADMIN",
        passwordHash: await hashSecret("demo1234"),
      },
      {
        schoolId,
        username: "office",
        name: "Front Office",
        role: "VIEWER",
        passwordHash: await hashSecret("demo1234"),
      },
    ],
  });

  // ── Crew ──────────────────────────────────────────────────────────────────
  const today = localDate();
  const driverRows = [
    { key: "DR1", crewId: "GF-DRV-0101", name: "Ramesh Kumar", phone: "+91 98490 33210", licenceNo: "TS 0220190004512", expiry: "2029-03-14", score: 94, status: "ON_DUTY" },
    { key: "DR2", crewId: "GF-DRV-0102", name: "Mahesh Yadav", phone: "+91 98490 33845", licenceNo: "TS 0220170002214", expiry: "2027-07-02", score: 81, status: "ON_DUTY" },
    // Expires soon on purpose: the drivers screen flags it.
    { key: "DR3", crewId: "GF-DRV-0103", name: "Imran Baig", phone: "+91 98490 71229", licenceNo: "TS 0220160009087", expiry: addDays(today, 24), score: 88, status: "ON_DUTY" },
    { key: "DR4", crewId: "GF-DRV-0104", name: "Naveen Rao", phone: "+91 98490 55008", licenceNo: "TS 0220180003341", expiry: "2028-01-11", score: 76, status: "IDLE" },
    { key: "DR5", crewId: "GF-DRV-0105", name: "Gopal Sharma", phone: "+91 98490 20114", licenceNo: "TS 0220200006612", expiry: "2030-04-22", score: 91, status: "OFF_DUTY" },
  ] as const;
  const attendantRows = [
    { key: "AT1", crewId: "GF-ATT-0142", name: "Suresh Kumar", phone: "+91 98490 44120", status: "ON_DUTY" },
    { key: "AT2", crewId: "GF-ATT-0143", name: "Kavitha Rani", phone: "+91 98490 44231", status: "ON_DUTY" },
    { key: "AT3", crewId: "GF-ATT-0144", name: "Suresh Naik", phone: "+91 98490 44890", status: "ON_DUTY" },
    { key: "AT4", crewId: "GF-ATT-0145", name: "Latha Devi", phone: "+91 98490 44712", status: "IDLE" },
  ] as const;

  const crew: Record<string, string> = {};
  for (const d of driverRows) {
    const row = await db.crew.create({
      data: {
        schoolId, crewId: d.crewId, role: "DRIVER", name: d.name, phone: e164(d.phone),
        pinHash: pin, pinSetAt: new Date(), licenceNo: d.licenceNo,
        licenceExpiry: dbDate(d.expiry), safetyScore: d.score, status: d.status,
      },
    });
    crew[d.key] = row.id;
  }
  for (const a of attendantRows) {
    const row = await db.crew.create({
      data: {
        schoolId, crewId: a.crewId, role: "ATTENDANT", name: a.name, phone: e164(a.phone),
        pinHash: pin, pinSetAt: new Date(), status: a.status,
      },
    });
    crew[a.key] = row.id;
  }

  // ── Stops ─────────────────────────────────────────────────────────────────
  const stopRows = [
    { key: "S1", name: "Kondapur Main Road", landmark: "Near Botanical Garden Road", lat: 17.4615, lng: 78.3637 },
    { key: "S2", name: "Botanical Garden", landmark: "Main gate", lat: 17.4573, lng: 78.3582 },
    { key: "S3", name: "Green Valley Apartments", landmark: "Opposite HDFC Bank", lat: 17.4512, lng: 78.3551 },
    { key: "S4", name: "Gachibowli Crossroads", landmark: "Under the flyover", lat: 17.4401, lng: 78.3489 },
    { key: "S5", name: "Bharath Vidya Mandir", landmark: "Campus gate 2", lat: 17.4302, lng: 78.3401 },
    { key: "S6", name: "Lanco Hills", landmark: "Tower 4 gate", lat: 17.4126, lng: 78.3725 },
    { key: "S7", name: "Nanakramguda Junction", landmark: "Beside Wells Fargo", lat: 17.4183, lng: 78.3474 },
    { key: "S8", name: "HITEC City MMTS", landmark: "Station forecourt", lat: 17.4485, lng: 78.3808 },
    { key: "S9", name: "Madhapur Police Station", landmark: "Opposite Inorbit Mall", lat: 17.4399, lng: 78.3887 },
    { key: "S10", name: "Ayyappa Society", landmark: "Near community hall", lat: 17.4446, lng: 78.3946 },
    { key: "S11", name: "Kukatpally Y Junction", landmark: "Under the metro pillar 312", lat: 17.4849, lng: 78.4138 },
    { key: "S12", name: "JNTU Metro Station", landmark: "Exit B", lat: 17.4933, lng: 78.3915 },
    { key: "S13", name: "Nizampet Crossroads", landmark: "Beside Ratnadeep", lat: 17.5158, lng: 78.3855 },
    { key: "S14", name: "Bachupally Road", landmark: "Opposite water tank", lat: 17.5401, lng: 78.3712 },
    { key: "S15", name: "Miyapur X Roads", landmark: "Metro gate 1", lat: 17.4968, lng: 78.3534 },
  ];
  const stop: Record<string, string> = {};
  for (const s of stopRows) {
    const row = await db.stop.create({
      data: { schoolId, name: s.name, landmark: s.landmark, lat: s.lat, lng: s.lng },
    });
    stop[s.key] = row.id;
  }

  // ── Routes and their ordered stops (pickup, drop) ─────────────────────────
  const routeRows = [
    {
      key: "R1", name: "Kondapur → School", zone: "West Hyderabad", km: 11.4, min: 45, status: "ACTIVE",
      stops: [["S1", "07:05", "16:44"], ["S2", "07:15", "16:32"], ["S3", "07:24", "16:20"], ["S4", "07:36", "16:06"], ["S5", "07:50", "15:48"]],
    },
    {
      key: "R2", name: "Gachibowli → School", zone: "West Hyderabad", km: 8.2, min: 38, status: "ACTIVE",
      stops: [["S6", "07:12", "16:34"], ["S7", "07:26", "16:18"], ["S5", "07:50", "15:48"]],
    },
    {
      key: "R3", name: "Madhapur → School", zone: "Central", km: 13.1, min: 52, status: "ACTIVE",
      stops: [["S8", "07:08", "16:40"], ["S9", "07:18", "16:26"], ["S10", "07:30", "16:12"], ["S5", "07:50", "15:48"]],
    },
    {
      key: "R4", name: "Kukatpally → School", zone: "North", km: 16.8, min: 58, status: "DRAFT",
      stops: [["S11", "06:52", "16:52"], ["S12", "07:02", "16:44"], ["S13", "07:14", "16:32"], ["S14", "07:24", "16:20"], ["S15", "07:34", "16:08"], ["S5", "07:50", "15:48"]],
    },
  ] as const;
  const route: Record<string, string> = {};
  const routeStops: Record<string, Array<{ stopId: string; pickup: string; drop: string }>> = {};
  for (const r of routeRows) {
    const row = await db.route.create({
      data: {
        schoolId, code: r.key, name: r.name, zone: r.zone, status: r.status,
        distanceM: Math.round(r.km * 1000), durationS: r.min * 60,
        stops: {
          create: r.stops.map(([key, pickupTime, dropTime], i) => ({
            stopId: stop[key], sequence: i + 1, pickupTime, dropTime,
          })),
        },
      },
    });
    route[r.key] = row.id;
    routeStops[r.key] = r.stops.map(([key, pickup, drop]) => ({ stopId: stop[key], pickup, drop }));
  }

  // ── Buses ─────────────────────────────────────────────────────────────────
  const busRows = [
    { number: "12", reg: "TS 09 UB 1234", cap: 42, driver: "DR1", attendant: "AT1", route: "R1", status: "ACTIVE", make: "Tata Starbus", year: 2022 },
    { number: "08", reg: "TS 09 UB 0871", cap: 40, driver: "DR2", attendant: "AT2", route: "R2", status: "DELAYED", make: "Tata Starbus", year: 2021 },
    { number: "21", reg: "TS 09 UB 2109", cap: 48, driver: "DR3", attendant: "AT3", route: "R3", status: "ACTIVE", make: "Ashok Leyland Lynx", year: 2023 },
    { number: "04", reg: "TS 09 UB 0442", cap: 42, driver: "DR4", attendant: "AT4", route: "R1", status: "OFFLINE", make: "Eicher Skyline", year: 2019 },
    { number: "17", reg: "TS 09 UB 1707", cap: 36, driver: "DR5", attendant: null, route: "R4", status: "IDLE", make: "Force Traveller", year: 2020 },
    { number: "09", reg: "TS 09 UB 0912", cap: 42, driver: null, attendant: null, route: null, status: "MAINTENANCE", make: "Eicher Skyline", year: 2018 },
  ] as const;
  const bus: Record<string, string> = {};
  for (const b of busRows) {
    const row = await db.bus.create({
      data: {
        schoolId, number: b.number, registration: b.reg, capacity: b.cap, make: b.make, year: b.year,
        status: b.status,
        driverId: b.driver ? crew[b.driver] : null,
        attendantId: b.attendant ? crew[b.attendant] : null,
        routeId: b.route ? route[b.route] : null,
      },
    });
    bus[b.number] = row.id;
  }

  // ── Students and guardians ────────────────────────────────────────────────
  // Saanvi and Ishaan's prototype stops sat on another bus's route; they are
  // moved to a stop on their own route so the roster and the map agree.
  const studentRows = [
    { key: "aarav", name: "Aarav Kumar", grade: "Grade 5", section: "B", roll: "5B-14", bus: "12", route: "R1", stop: "S3", parent: "Rajesh Kumar", phone: "+91 98490 21145" },
    { key: "diya", name: "Diya Sharma", grade: "Grade 3", section: "A", roll: "3A-07", bus: "12", route: "R1", stop: "S2", parent: "Anil Sharma", phone: "+91 98490 55231" },
    { key: "rahul", name: "Rahul Reddy", grade: "Grade 8", section: "C", roll: "8C-21", bus: "08", route: "R2", stop: "S6", parent: "Sunil Reddy", phone: "+91 98490 77410" },
    { key: "ananya", name: "Ananya Patel", grade: "Grade 6", section: "A", roll: "6A-03", bus: "21", route: "R3", stop: "S8", parent: "Nikhil Patel", phone: "+91 98490 66123" },
    { key: "vihaan", name: "Vihaan Mehta", grade: "Grade 4", section: "B", roll: "4B-11", bus: "12", route: "R1", stop: "S1", parent: "Kunal Mehta", phone: "+91 98490 31882" },
    { key: "saanvi", name: "Saanvi Rao", grade: "Grade 7", section: "A", roll: "7A-18", bus: "21", route: "R3", stop: "S10", parent: "Prakash Rao", phone: "+91 98490 90233" },
    { key: "ishaan", name: "Ishaan Gupta", grade: "Grade 2", section: "C", roll: "2C-09", bus: "08", route: "R2", stop: "S7", parent: "Vikas Gupta", phone: "+91 98490 12094" },
    { key: "myra", name: "Myra Nair", grade: "Grade 9", section: "B", roll: "9B-02", bus: "12", route: "R1", stop: "S3", parent: "Suresh Nair", phone: "+91 98490 48810" },
  ] as const;
  const student: Record<string, { id: string; bus: string; route: string; stopId: string }> = {};
  const guardianOf: Record<string, string[]> = {};
  for (const s of studentRows) {
    const row = await db.student.create({
      data: {
        schoolId, name: s.name, grade: s.grade, section: s.section, roll: s.roll,
        busId: bus[s.bus], routeId: route[s.route], stopId: stop[s.stop],
        guardians: {
          create: {
            relation: "Father",
            primary: true,
            guardian: { create: { schoolId, name: s.parent, phone: e164(s.phone) } },
          },
        },
      },
      include: { guardians: true },
    });
    student[s.key] = { id: row.id, bus: s.bus, route: s.route, stopId: stop[s.stop] };
    guardianOf[s.key] = row.guardians.map((g) => g.guardianId);
  }

  // The parent-app demo account: one guardian with two children on Bus 12.
  const demoParent = await db.guardian.create({
    data: {
      schoolId, name: "Arumugam R", phone: "+919848012345", email: "arumugam.r@example.com",
      students: {
        create: [
          { studentId: student.aarav.id, relation: "Guardian", primary: false },
          { studentId: student.diya.id, relation: "Guardian", primary: false },
        ],
      },
    },
  });
  guardianOf.aarav.push(demoParent.id);
  guardianOf.diya.push(demoParent.id);

  // ── Trip history: the last ten school days, both phases ───────────────────
  const random = rng(42);
  const runningBuses = [
    { number: "12", route: "R1", driver: "DR1", attendant: "AT1" },
    { number: "08", route: "R2", driver: "DR2", attendant: "AT2" },
    { number: "21", route: "R3", driver: "DR3", attendant: "AT3" },
  ];
  const schoolDays: string[] = [];
  for (let back = 1; schoolDays.length < 10; back++) {
    const d = addDays(today, -back);
    const weekday = dbDate(d).getUTCDay();
    if (weekday !== 0 && weekday !== 6) schoolDays.push(d);
  }

  let tripCount = 0;
  let markCount = 0;
  const notifications: Array<{
    guardianId: string; studentId: string; type: string; title: string; body: string; sentAt: Date; readAt: Date | null;
  }> = [];

  for (const d of schoolDays.reverse()) {
    const absentToday = new Set(
      studentRows.filter(() => random() < 0.06).map((s) => s.key),
    );
    for (const phase of ["MORNING", "EVENING"] as TripPhase[]) {
      for (const b of runningBuses) {
        const delay = random() < 0.15 ? Math.round(5 + random() * 12) : 0;
        const stops = routeStops[b.route];
        const schoolStop = stops[stops.length - 1];
        const first = phase === "MORNING" ? stops[0].pickup : schoolStop.drop;
        const last = phase === "MORNING" ? schoolStop.pickup : stops[0].drop;
        const trip = await db.trip.create({
          data: {
            schoolId, date: dbDate(d), phase, busId: bus[b.number], routeId: route[b.route],
            driverId: crew[b.driver], attendantId: crew[b.attendant], status: "COMPLETED",
            startedAt: at(d, first, -10 + delay), completedAt: at(d, last, delay + 4), delayMin: delay,
          },
        });
        tripCount++;

        const riders = studentRows.filter((s) => s.bus === b.number);
        const marks = riders.flatMap((s) => {
          const own = stops.find((x) => x.stopId === stop[s.stop]) ?? stops[0];
          const absent = absentToday.has(s.key);
          const boardAt = phase === "MORNING" ? at(d, own.pickup, delay + 1) : at(d, schoolStop.drop, 2);
          const dropAt = phase === "MORNING" ? at(d, schoolStop.pickup, delay) : at(d, own.drop, delay);
          const boardStatus: MarkStatus = absent ? "ABSENT" : "BOARDED";
          const rows: Prisma.AttendanceMarkCreateManyInput[] = [
            {
              tripId: trip.id, studentId: student[s.key].id, phase: "BOARD", status: boardStatus,
              stopId: phase === "MORNING" ? own.stopId : schoolStop.stopId,
              clientMarkId: `seed-${trip.id}-${s.key}-b`, markedAt: boardAt, receivedAt: boardAt,
              markedById: crew[b.attendant],
            },
          ];
          if (!absent) {
            rows.push({
              tripId: trip.id, studentId: student[s.key].id, phase: "DROP", status: "DROPPED",
              stopId: phase === "MORNING" ? schoolStop.stopId : own.stopId,
              clientMarkId: `seed-${trip.id}-${s.key}-d`, markedAt: dropAt, receivedAt: dropAt,
              markedById: crew[b.attendant],
            });
          }
          // Alerts for the demo parent's children over the last two days.
          if ((s.key === "aarav" || s.key === "diya") && schoolDays.indexOf(d) >= schoolDays.length - 2) {
            const first = s.name.split(" ")[0];
            const stopName = stopRows.find((x) => stop[x.key] === own.stopId)?.name ?? "the stop";
            for (const guardianId of guardianOf[s.key]) {
              if (absent) {
                notifications.push({
                  guardianId, studentId: student[s.key].id, type: "attendance",
                  title: `${first} marked absent`, body: `Not at ${stopName} when Bus ${b.number} arrived.`,
                  sentAt: boardAt, readAt: boardAt,
                });
                continue;
              }
              notifications.push(
                {
                  guardianId, studentId: student[s.key].id, type: "attendance",
                  title: `${first} boarded the bus`,
                  body: phase === "MORNING"
                    ? `Marked by attendant Suresh Kumar at ${stopName}.`
                    : `Boarded Bus ${b.number} at school for the ride home.`,
                  sentAt: boardAt, readAt: boardAt,
                },
                {
                  guardianId, studentId: student[s.key].id, type: "attendance",
                  title: phase === "MORNING" ? `${first} reached school safely` : `${first} was dropped at ${stopName}`,
                  body: phase === "MORNING" ? `Bus ${b.number} arrived at Bharath Vidya Mandir.` : `Dropped by Bus ${b.number}.`,
                  sentAt: dropAt, readAt: null,
                },
              );
            }
          }
          return rows;
        });
        await db.attendanceMark.createMany({ data: marks });
        markCount += marks.length;
      }
    }
  }

  // Today's morning run, underway on Bus 08 and Bus 21.
  for (const b of runningBuses.filter((x) => x.number !== "12")) {
    const stops = routeStops[b.route];
    const trip = await db.trip.create({
      data: {
        schoolId, date: dbDate(today), phase: "MORNING", busId: bus[b.number], routeId: route[b.route],
        driverId: crew[b.driver], attendantId: crew[b.attendant], status: "ACTIVE",
        startedAt: at(today, stops[0].pickup, -10), delayMin: b.number === "08" ? 12 : 0,
      },
    });
    tripCount++;
    const riders = studentRows.filter((s) => s.bus === b.number);
    const marks = riders.map((s) => ({
      tripId: trip.id, studentId: student[s.key].id, phase: "BOARD" as const,
      status: (s.key === "rahul" ? "ABSENT" : "BOARDED") as MarkStatus,
      stopId: stop[s.stop], clientMarkId: `seed-${trip.id}-${s.key}-b`,
      markedAt: at(today, stops[0].pickup, 8), markedById: crew[b.attendant],
    }));
    await db.attendanceMark.createMany({ data: marks });
    markCount += marks.length;
  }

  // ── Absence requests ──────────────────────────────────────────────────────
  await db.absenceRequest.createMany({
    data: [
      {
        schoolId, studentId: student.rahul.id, guardianId: guardianOf.rahul[0],
        date: dbDate(today), phase: "both", reason: "Fever", acknowledgedAt: new Date(),
      },
      {
        schoolId, studentId: student.diya.id, guardianId: demoParent.id,
        date: dbDate(addDays(today, 3)), phase: "am", reason: "Doctor's appointment",
      },
    ],
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  const yesterday = schoolDays[schoolDays.length - 1];
  notifications.push(
    {
      guardianId: demoParent.id, studentId: student.aarav.id, type: "alert",
      title: "Return bus delayed by 10 minutes",
      body: "Traffic near Gachibowli flyover. New arrival about 4:42 PM.",
      sentAt: at(yesterday, "16:10"), readAt: null,
    },
    {
      guardianId: demoParent.id, studentId: student.diya.id, type: "transport",
      title: `Route change for ${addDays(today, 2)}`,
      body: "Road work on Botanical Garden road. Pickup moves 5 minutes earlier.",
      sentAt: at(yesterday, "18:00"), readAt: null,
    },
  );
  await db.notification.createMany({
    data: notifications.map((n) => ({ ...n, schoolId, audience: "GUARDIAN" as const })),
  });

  // ── Cameras and recordings ────────────────────────────────────────────────
  const cameraIds: Record<string, Record<string, string>> = {};
  for (const b of busRows) {
    cameraIds[b.number] = {};
    for (const label of ["Cabin", "Front", "Door"]) {
      const status =
        b.number === "08" && label === "Door" ? "OFFLINE"
        : b.number === "17" && label === "Cabin" ? "RECORDING_ISSUE"
        : b.number === "09" ? "OFFLINE"
        : "ONLINE";
      const cam = await db.camera.create({
        data: {
          schoolId, busId: bus[b.number], label, status,
          streamKey: `bus${b.number}-${label.toLowerCase()}`, firmware: "v2.4.1",
          lastSeenAt: status === "ONLINE" ? new Date() : at(today, "06:58"),
        },
      });
      cameraIds[b.number][label] = cam.id;
    }
  }
  const recordings = [
    { bus: "12", cam: "Cabin", event: "harsh_braking", day: today, time: "08:14", dur: 48 },
    { bus: "12", cam: "Door", event: "door_open", day: today, time: "08:42", dur: 42 },
    { bus: "12", cam: "Front", event: "scheduled", day: yesterday, time: "07:00", dur: 3600 },
    { bus: "08", cam: "Front", event: "manual", day: today, time: "06:57", dur: 110 },
    { bus: "21", cam: "Front", event: "scheduled", day: yesterday, time: "16:11", dur: 152 },
    { bus: "04", cam: "Door", event: "sos", day: addDays(today, -6), time: "07:02", dur: 150 },
  ];
  const recordingIds: string[] = [];
  for (const r of recordings) {
    const startedAt = at(r.day, r.time);
    const rec = await db.recording.create({
      data: {
        schoolId, cameraId: cameraIds[r.bus][r.cam], busId: bus[r.bus], eventType: r.event,
        startedAt, durationS: r.dur, sizeBytes: BigInt(r.dur * 450_000),
        storageKey: `recordings/bus${r.bus}/${r.day}/${r.time.replace(":", "")}-${r.cam.toLowerCase()}.mp4`,
        expiresAt: new Date(startedAt.getTime() + 30 * 86_400_000),
      },
    });
    recordingIds.push(rec.id);
  }

  // ── Incidents ─────────────────────────────────────────────────────────────
  const admin = await db.adminUser.findFirstOrThrow({ where: { schoolId, username: "transport" } });
  const incidents = [
    {
      code: "INC-1024", bus: "12", type: "Harsh braking", severity: "HIGH", status: "UNDER_REVIEW", assignedTo: "Arumugam K.",
      occurredAt: at(today, "08:15"), clip: 0,
      description: "Harsh braking detected on Bus 12 at 8:15 AM near Botanical Garden while travelling at 46 km/h. Attendant reported no injuries. 38 students were onboard.",
      notes: ["Attendant Suresh Kumar confirmed all students seated.", "Driver briefed on speed governor settings. Awaiting transport head sign-off."],
    },
    {
      code: "INC-1023", bus: "08", type: "Camera offline", severity: "MEDIUM", status: "INVESTIGATING", assignedTo: "Fleet Support",
      occurredAt: at(today, "06:58"), clip: 3,
      description: "The door camera on Bus 08 stopped streaming at 6:58 AM. Front and cabin cameras continued recording throughout the morning trip.",
      notes: ["Vendor ticket raised.", "Replacement unit dispatched for fitting."],
    },
    {
      code: "INC-1019", bus: "21", type: "Route deviation", severity: "LOW", status: "RESOLVED", assignedTo: "Imran Baig",
      occurredAt: at(yesterday, "16:12"), clip: 4,
      description: "Bus 21 deviated from the Madhapur route for 1.4 km at 4:12 PM. Driver reported a road closure at Ayyappa Society.",
      notes: ["Road closure confirmed with the traffic control room. No action required against the driver."],
    },
    {
      code: "INC-1016", bus: "04", type: "Student left behind", severity: "HIGH", status: "CLOSED", assignedTo: "Principal Office",
      occurredAt: at(addDays(today, -6), "07:44"), clip: 5,
      description: "A student was not picked up at Kondapur Main Road. The parent called the office at 7:44 AM and the student was collected by the next bus.",
      notes: ["Attendant retrained on the stop roster.", "Parent contacted by the principal. Case closed."],
    },
  ] as const;
  for (const inc of incidents) {
    await db.incident.create({
      data: {
        schoolId, code: inc.code, busId: bus[inc.bus], type: inc.type, severity: inc.severity, status: inc.status,
        description: inc.description, assignedTo: inc.assignedTo, occurredAt: inc.occurredAt,
        resolvedAt: inc.status === "RESOLVED" || inc.status === "CLOSED" ? new Date(inc.occurredAt.getTime() + 2 * 86_400_000) : null,
        clipIds: [recordingIds[inc.clip]],
        events: {
          create: [
            { actorId: admin.id, action: "CREATED", note: null, createdAt: inc.occurredAt },
            ...inc.notes.map((note, i) => ({
              actorId: admin.id, action: "NOTE", note,
              createdAt: new Date(inc.occurredAt.getTime() + (i + 1) * 3_600_000),
            })),
          ],
        },
      },
    });
  }

  // ── School trips ──────────────────────────────────────────────────────────
  const schoolTrips = [
    {
      code: "T-1041", name: "Grade 6 science museum visit", destination: "Birla Science Museum, Naubat Pahad",
      date: today, depart: "08:30", ret: "14:30", teacher: "Meera Krishnan", status: "ON_THE_WAY",
      notes: "Packed lunch, return via Banjara Hills", consentAll: true,
      fleet: [["21", "DR3", "AT3", 44], ["12", "DR1", "AT1", 38]],
    },
    {
      code: "T-1042", name: "Grade 9 inter-school sports meet", destination: "Gachibowli Stadium",
      date: addDays(today, 4), depart: "07:00", ret: "17:00", teacher: "Arun Prasad", status: "SCHEDULED",
      notes: "Sports kit in cargo hold", consentAll: false,
      fleet: [["12", "DR1", "AT1", 24]],
    },
    {
      code: "T-1039", name: "Grade 4 zoo excursion", destination: "Nehru Zoological Park",
      date: addDays(today, -6), depart: "08:00", ret: "15:00", teacher: "Divya Menon", status: "COMPLETED",
      notes: "", consentAll: true,
      fleet: [["17", "DR5", null, 41], ["04", "DR4", "AT4", 39], ["08", "DR2", "AT2", 36]],
    },
  ] as const;
  for (const t of schoolTrips) {
    const manifest = t.code === "T-1042"
      ? [{ studentId: student.myra.id, consentAt: null }, { studentId: student.rahul.id, consentAt: new Date() }]
      : t.code === "T-1041"
        ? [{ studentId: student.ananya.id, consentAt: new Date() }, { studentId: student.saanvi.id, consentAt: new Date() }]
        : [{ studentId: student.vihaan.id, consentAt: new Date() }];
    await db.schoolTrip.create({
      data: {
        schoolId, code: t.code, name: t.name, destination: t.destination, date: dbDate(t.date),
        departTime: t.depart, returnTime: t.ret, teacherName: t.teacher, notes: t.notes || null,
        status: t.status,
        fleet: {
          create: t.fleet.map(([number, driver, attendant, count]) => ({
            busId: bus[number], driverId: crew[driver], attendantId: attendant ? crew[attendant] : null,
            studentCount: count,
          })),
        },
        manifest: { create: manifest },
      },
    });
  }

  // ── Bus compliance documents (metadata; the files are placeholders) ───────
  const docs: Record<string, Record<string, { file: string; size: string; on: string; exp: string }>> = {
    "12": {
      rc: { file: "ts09ub1234-rc.pdf", size: "1.2 MB", on: "12 Jan 2026", exp: "—" },
      fitness: { file: "fitness-2026.pdf", size: "640 KB", on: "14 Mar 2026", exp: "14 Mar 2027" },
      insurance: { file: "insurance-policy.pdf", size: "890 KB", on: "02 Jan 2026", exp: "02 Jan 2027" },
      permit: { file: "school-permit.pdf", size: "410 KB", on: "08 Feb 2026", exp: "08 Feb 2027" },
      puc: { file: "puc-sep.pdf", size: "210 KB", on: "01 Sep 2026", exp: "01 Mar 2027" },
    },
    "08": {
      rc: { file: "ts09ub0871-rc.pdf", size: "1.1 MB", on: "20 Nov 2025", exp: "—" },
      insurance: { file: "insurance-0871.pdf", size: "870 KB", on: "19 Feb 2026", exp: "19 Feb 2027" },
    },
    "21": {
      rc: { file: "ts09ub2109-rc.pdf", size: "1.3 MB", on: "05 Aug 2025", exp: "—" },
      fitness: { file: "fitness-2109.pdf", size: "620 KB", on: "22 Apr 2026", exp: "22 Apr 2027" },
      insurance: { file: "insurance-2109.pdf", size: "910 KB", on: "11 Mar 2026", exp: "11 Mar 2027" },
      permit: { file: "permit-2109.pdf", size: "430 KB", on: "30 Jan 2026", exp: "30 Jan 2027" },
      puc: { file: "puc-2109.pdf", size: "220 KB", on: "18 Aug 2026", exp: "18 Feb 2027" },
      speed: { file: "governor-2109.pdf", size: "180 KB", on: "02 Sep 2026", exp: "02 Sep 2027" },
    },
    "17": { rc: { file: "ts09ub1707-rc.pdf", size: "1.0 MB", on: "14 Jun 2025", exp: "—" } },
  };
  await db.document.createMany({
    data: Object.entries(docs).flatMap(([number, kinds]) =>
      Object.entries(kinds).map(([kind, d]) => ({
        schoolId, ownerType: "BUS" as const, ownerId: bus[number], kind, fileName: d.file,
        storageKey: `seed/${number}/${d.file}`, sizeBytes: bytes(d.size),
        issuedOn: day(d.on), expiresOn: day(d.exp),
      })),
    ),
  });
  await db.document.create({
    data: {
      schoolId, ownerType: "DRIVER", ownerId: crew.DR1, kind: "licence",
      fileName: "ramesh-kumar-licence.pdf", storageKey: "seed/crew/ramesh-kumar-licence.pdf",
      sizeBytes: bytes("386 KB"), expiresOn: dbDate("2029-03-14"),
    },
  });

  say(`Seeded Bharath Vidya Mandir: 6 buses, 4 routes, 15 stops, 8 students, 9 crew, ${tripCount} trips, ${markCount} attendance marks.`);
  say("Admin  transport@bvm.edu.in / demo1234");
  say("Parent 98480 12345 (OTP on screen with DEV_ECHO_SECRETS=1)");
  say("Crew   GF-ATT-0142 / 1234");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
