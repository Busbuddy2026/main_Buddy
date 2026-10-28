/** Page ids from the prototype, mapped onto real App Router paths. */
export type PageId =
  | "overview" | "live" | "trips" | "monitor"
  | "buses" | "bus" | "routes" | "route" | "stops"
  | "students" | "student" | "drivers" | "attendants"
  | "schooltrips" | "schooltrip"
  | "attendance" | "history"
  | "cctv" | "health" | "incidents" | "incident"
  | "analytics" | "efficiency" | "driverperf" | "punctuality" | "fleet" | "monthly" | "reports"
  | "optimize" | "settings";

export const PATHS: Record<PageId, string> = {
  overview: "/admin",
  live: "/admin/live",
  trips: "/admin/live/trips",
  monitor: "/admin/live/monitor",
  buses: "/admin/buses",
  bus: "/admin/buses",
  routes: "/admin/routes",
  route: "/admin/routes",
  stops: "/admin/stops",
  students: "/admin/students",
  student: "/admin/students",
  drivers: "/admin/drivers",
  attendants: "/admin/attendants",
  schooltrips: "/admin/school-trips",
  schooltrip: "/admin/school-trips",
  attendance: "/admin/attendance",
  history: "/admin/attendance/history",
  cctv: "/admin/cctv",
  health: "/admin/cctv/health",
  incidents: "/admin/incidents",
  incident: "/admin/incidents",
  analytics: "/admin/analytics",
  efficiency: "/admin/analytics/efficiency",
  driverperf: "/admin/analytics/drivers",
  punctuality: "/admin/analytics/punctuality",
  fleet: "/admin/analytics/fleet",
  monthly: "/admin/analytics/monthly",
  reports: "/admin/analytics/reports",
  optimize: "/admin/optimize",
  settings: "/admin/settings",
};

export interface NavChild {
  id: PageId;
  label: string;
  href: string;
}

export interface NavGroup {
  id: PageId;
  label: string;
  icon: string;
  href: string;
  soon?: boolean;
  /** Shows the open-incident count as a badge. */
  incidents?: boolean;
  kids?: NavChild[];
}

const kid = (id: PageId, label: string): NavChild => ({ id, label, href: PATHS[id] });

export const NAV: NavGroup[] = [
  {
    id: "live", label: "Live Operations", icon: "sensors", href: PATHS.live,
    kids: [kid("live", "Live Map"), kid("trips", "Active Trips"), kid("monitor", "Bus Monitoring")],
  },
  {
    id: "buses", label: "Transport", icon: "directions_bus", href: PATHS.buses,
    kids: [kid("buses", "Buses"), kid("routes", "Routes"), kid("stops", "Stops")],
  },
  {
    id: "students", label: "People", icon: "badge", href: PATHS.students,
    kids: [kid("students", "Students"), kid("drivers", "Drivers"), kid("attendants", "Attendants")],
  },
  { id: "schooltrips", label: "School Trips", icon: "tour", href: PATHS.schooltrips },
  {
    id: "attendance", label: "Attendance", icon: "checklist", href: PATHS.attendance,
    kids: [kid("attendance", "Today's Attendance"), kid("history", "Attendance History")],
  },
  {
    id: "cctv", label: "CCTV & Safety", icon: "videocam", href: PATHS.cctv, incidents: true,
    kids: [kid("cctv", "Live CCTV"), kid("health", "Camera Health"), kid("incidents", "Incidents")],
  },
  {
    id: "analytics", label: "Analytics", icon: "insights", href: PATHS.analytics,
    kids: [
      kid("analytics", "Transport Analytics"),
      kid("efficiency", "Fuel & Idling"),
      kid("driverperf", "Driver Safety"),
      kid("punctuality", "Punctuality"),
      kid("fleet", "Fleet Health"),
      kid("monthly", "Monthly Report"),
      kid("reports", "Reports"),
    ],
  },
  { id: "optimize", label: "Route Optimization", icon: "route", href: PATHS.optimize, soon: true },
  { id: "settings", label: "Settings", icon: "settings", href: PATHS.settings },
];

/** Which nav group owns each page — detail pages stay under their list's group. */
export const GROUP_OF: Record<PageId, PageId> = {
  overview: "overview",
  live: "live", trips: "live", monitor: "live",
  buses: "buses", bus: "buses", routes: "buses", route: "buses", stops: "buses",
  students: "students", student: "students", drivers: "students", attendants: "students",
  schooltrips: "schooltrips", schooltrip: "schooltrips",
  attendance: "attendance", history: "attendance",
  cctv: "cctv", health: "cctv", incidents: "cctv", incident: "cctv",
  analytics: "analytics", efficiency: "analytics", driverperf: "analytics", punctuality: "analytics", fleet: "analytics", monthly: "analytics", reports: "analytics",
  optimize: "optimize", settings: "settings",
};

/** Page title and subtitle for the sticky header. */
export const TITLES: Record<PageId, [string, string]> = {
  overview: ["Overview", "Today across the fleet"],
  live: ["Live Operations", "Every bus on the map, from its GPS tracker"],
  trips: ["Active Trips", "Trips in progress and students onboard"],
  monitor: ["Bus Monitoring", "Telemetry, GPS and camera state per vehicle"],
  buses: ["Buses", "Vehicles, trackers and documents"],
  bus: ["Bus profile", "Vehicle, crew, route and safety record"],
  routes: ["Routes", "Stop sequences and assigned buses"],
  route: ["Route details", "Stop sequence, timings and assigned students"],
  stops: ["Stops", "Pickup and drop points"],
  students: ["Students", "Students using school transport"],
  student: ["Student transport profile", "Today's journey and history"],
  drivers: ["Drivers", "Licences, assignments and safety scores"],
  attendants: ["Attendants", "Bus attendants and their assignments"],
  schooltrips: ["School Trips", "Excursions, sports meets and off-campus travel"],
  schooltrip: ["School trip", "Configuration, manifest and live tracking"],
  attendance: ["Attendance Control Center", "Boarding and drops marked by bus attendants"],
  history: ["Attendance History", "Daily boarding and drop records"],
  cctv: ["Live CCTV", "Dashcam streams per bus"],
  health: ["Camera Health", "Camera status per bus"],
  incidents: ["Incidents", "SOS, tracker alarms and office reports"],
  incident: ["Incident detail", "Timeline, footage and resolution"],
  analytics: ["Transport Analytics", "Last 30 days · all routes"],
  efficiency: ["Fuel & Idling", "Distance, idling, estimated fuel and cost per bus"],
  driverperf: ["Driver Safety", "Scores, overspeed hotspots, after-hours use and detours"],
  punctuality: ["Punctuality", "Arrival at school, typical stop times and ride lengths"],
  fleet: ["Fleet Health", "Bus usage, service due and route suggestions"],
  monthly: ["Monthly Report", "One page per month for management"],
  reports: ["Reports", "Scheduled and on-demand exports"],
  optimize: ["Route Optimization", "Coming soon"],
  settings: ["Settings", "Transport, attendance and safety configuration"],
};

/** Resolve the active page id from a pathname. Longest static match wins,
 *  then the detail-page variants for dynamic segments.
 *
 *  Pathnames arrive mounted at `/admin`; the tables below describe routes
 *  *within* the console, so the mount point is stripped once here rather than
 *  repeated on every entry. */
export function pageIdFor(pathname: string): PageId {
  const path = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";

  const exact: Array<[string, PageId]> = [
    ["/", "live"],
    ["/live", "live"], ["/live/trips", "trips"], ["/live/monitor", "monitor"],
    ["/buses", "buses"], ["/routes", "routes"], ["/stops", "stops"],
    ["/students", "students"], ["/drivers", "drivers"], ["/attendants", "attendants"],
    ["/school-trips", "schooltrips"],
    ["/attendance", "attendance"], ["/attendance/history", "history"],
    ["/cctv", "cctv"], ["/cctv/health", "health"],
    ["/incidents", "incidents"],
    ["/analytics", "analytics"], ["/analytics/efficiency", "efficiency"], ["/analytics/drivers", "driverperf"],
    ["/analytics/punctuality", "punctuality"], ["/analytics/fleet", "fleet"], ["/analytics/monthly", "monthly"],
    ["/analytics/reports", "reports"],
    ["/optimize", "optimize"], ["/settings", "settings"],
  ];
  const hit = exact.find(([p]) => p === path);
  if (hit) return hit[1];

  const detail: Array<[string, PageId]> = [
    ["/buses/", "bus"], ["/routes/", "route"], ["/students/", "student"],
    ["/school-trips/", "schooltrip"], ["/incidents/", "incident"],
  ];
  const d = detail.find(([p]) => path.startsWith(p));
  return d ? d[1] : "live";
}
