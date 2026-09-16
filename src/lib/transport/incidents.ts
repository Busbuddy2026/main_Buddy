import { pill, type PillSpec } from "./tone";

export interface Incident {
  id: string;
  bus: string;
  type: string;
  when: string;
  sev: PillSpec;
  status: PillSpec;
  who: string;
  /** Index into INCIDENT_STEPS. */
  step: number;
  summary: string;
  trip: string;
  driver: string;
  reg: string;
  onboard: string;
  clip: string;
  notes: string;
  severityLabel: string;
}

export const INCIDENT_STEPS = [
  "New",
  "Under Review",
  "Investigating",
  "Resolved",
  "Closed",
] as const;

export const INCIDENTS: Incident[] = [
  {
    id: "INC-1024", bus: "Bus 12", type: "Harsh braking", when: "8 Sep · 8:15 AM",
    sev: pill("High", "bad"), status: pill("Under review", "delayed"), who: "Arumugam K.", step: 1,
    severityLabel: "High priority",
    summary:
      "Harsh braking detected on Bus 12 at 8:15 AM near Botanical Garden while travelling at 46 km/h. Attendant reported no injuries. 38 students were onboard.",
    trip: "Morning · Kondapur", driver: "Ramesh Kumar", reg: "TS 09 UB 1234", onboard: "38",
    clip: "Bus 12 · Cabin · 08:14:48 – 08:15:36",
    notes:
      "Attendant Suresh Kumar confirmed all students seated. Driver briefed on speed governor settings. Awaiting transport head sign-off.",
  },
  {
    id: "INC-1023", bus: "Bus 08", type: "Camera offline", when: "8 Sep · 6:58 AM",
    sev: pill("Medium", "delayed"), status: pill("Investigating", "ontime"), who: "Fleet Support", step: 2,
    severityLabel: "Medium priority",
    summary:
      "The door camera on Bus 08 stopped streaming at 6:58 AM. Front and cabin cameras continued recording throughout the morning trip.",
    trip: "Morning · Gachibowli", driver: "Mahesh Yadav", reg: "TS 09 UB 0871", onboard: "31",
    clip: "Bus 08 · Front · 06:57:20 – 06:59:10",
    notes: "Vendor ticket raised. Replacement unit dispatched for fitting on 10 Sep.",
  },
  {
    id: "INC-1019", bus: "Bus 21", type: "Route deviation", when: "5 Sep · 4:12 PM",
    sev: pill("Low", "offline"), status: pill("Resolved", "good"), who: "Imran Baig", step: 3,
    severityLabel: "Low priority",
    summary:
      "Bus 21 deviated from the Madhapur route for 1.4 km at 4:12 PM. Driver reported a road closure at Ayyappa Society.",
    trip: "Evening · Madhapur", driver: "Imran Baig", reg: "TS 09 UB 2109", onboard: "44",
    clip: "Bus 21 · Front · 16:11:30 – 16:14:02",
    notes: "Road closure confirmed with the traffic control room. No action required against the driver.",
  },
  {
    id: "INC-1016", bus: "Bus 04", type: "Student left behind", when: "2 Sep · 7:44 AM",
    sev: pill("High", "bad"), status: pill("Closed", "offline"), who: "Principal Office", step: 4,
    severityLabel: "High priority",
    summary:
      "A student was not picked up at Kondapur Main Road on 2 Sep. The parent called the office at 7:44 AM and the student was collected by the next bus.",
    trip: "Morning · Kondapur", driver: "Naveen Rao", reg: "TS 09 UB 0442", onboard: "0",
    clip: "Bus 04 · Door · 07:02:10 – 07:04:40",
    notes:
      "Attendant retrained on the stop roster. Parent contacted by the principal. Case closed on 4 Sep.",
  },
];
