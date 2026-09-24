/** Page ids from the prototype, mapped onto real App Router paths. */
export type PageId =
  | "overview" | "live" | "trips" | "monitor"
  | "buses" | "bus" | "routes" | "route" | "stops"
  | "students" | "student" | "drivers" | "attendants"
  | "schooltrips" | "schooltrip"
  | "attendance" | "history"
  | "cctv" | "recordings" | "health" | "incidents" | "incident"
  | "analytics" | "driverperf" | "reports"
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
  recordings: "/admin/cctv/recordings",
  health: "/admin/cctv/health",
  incidents: "/admin/incidents",
  incident: "/admin/incidents",
  analytics: "/admin/analytics",
  driverperf: "/admin/analytics/drivers",
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
  count?: number;
  kids?: NavChild[];
}

const kid = (id: PageId, label: string): NavChild => ({ id, label, href: PATHS[id] });

export const NAV: NavGroup[] = [
  { id: "overview", label: "Overview", icon: "space_dashboard", href: PATHS.overview },
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
    id: "cctv", label: "CCTV & Safety", icon: "videocam", href: PATHS.cctv, count: 2,
    kids: [kid("cctv", "Live CCTV"), kid("recordings", "Recordings"), kid("health", "Camera Health"), kid("incidents", "Incidents")],
  },
  {
    id: "analytics", label: "Analytics", icon: "insights", href: PATHS.analytics,
    kids: [kid("analytics", "Transport Analytics"), kid("driverperf", "Driver Performance"), kid("reports", "Reports")],
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
  cctv: "cctv", recordings: "cctv", health: "cctv", incidents: "cctv", incident: "cctv",
  analytics: "analytics", driverperf: "analytics", reports: "analytics",
  optimize: "optimize", settings: "settings",
};

/** Page title and subtitle for the sticky header. */
export const TITLES: Record<PageId, [string, string]> = {
  overview: ["Overview", "Tuesday, 8 September · 7:42 AM · Morning session"],
  live: ["Live Operations", "4 buses tracked · 1 delayed · 1 GPS offline"],
  trips: ["Active Trips", "3 trips in progress · 113 students onboard"],
  monitor: ["Bus Monitoring", "Telemetry, GPS and camera state per vehicle"],
  buses: ["Buses", "24 vehicles · 22 in service"],
  bus: ["Bus profile", "Vehicle, crew, route and safety record"],
  routes: ["Routes", "18 active routes across 3 zones"],
  route: ["Route details", "Stop sequence, timings and assigned students"],
  stops: ["Stops", "96 stops · grouped by zone"],
  students: ["Students", "1,284 students using school transport"],
  student: ["Student transport profile", "Today's journey and history"],
  drivers: ["Drivers", "26 drivers · 2 licences expiring this month"],
  attendants: ["Attendants", "24 attendants on duty today"],
  schooltrips: ["School Trips", "Excursions, sports meets and off-campus travel"],
  schooltrip: ["School trip", "Configuration, manifest and live tracking"],
  attendance: ["Attendance Control Center", "Morning trip · marked by bus attendants"],
  history: ["Attendance History", "Daily boarding and drop records"],
  cctv: ["Live CCTV", "68 of 72 cameras online"],
  recordings: ["Recordings", "Event-indexed footage, retained 30 days"],
  health: ["Camera Health", "4 cameras need attention"],
  incidents: ["Incidents", "2 open · 1 high priority"],
  incident: ["Incident detail", "Timeline, footage and resolution"],
  analytics: ["Transport Analytics", "Last 30 days · all routes"],
  driverperf: ["Driver Performance", "Safety scores and violation trends"],
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
    ["/", "overview"],
    ["/live", "live"], ["/live/trips", "trips"], ["/live/monitor", "monitor"],
    ["/buses", "buses"], ["/routes", "routes"], ["/stops", "stops"],
    ["/students", "students"], ["/drivers", "drivers"], ["/attendants", "attendants"],
    ["/school-trips", "schooltrips"],
    ["/attendance", "attendance"], ["/attendance/history", "history"],
    ["/cctv", "cctv"], ["/cctv/recordings", "recordings"], ["/cctv/health", "health"],
    ["/incidents", "incidents"],
    ["/analytics", "analytics"], ["/analytics/drivers", "driverperf"], ["/analytics/reports", "reports"],
    ["/optimize", "optimize"], ["/settings", "settings"],
  ];
  const hit = exact.find(([p]) => p === path);
  if (hit) return hit[1];

  const detail: Array<[string, PageId]> = [
    ["/buses/", "bus"], ["/routes/", "route"], ["/students/", "student"],
    ["/school-trips/", "schooltrip"], ["/incidents/", "incident"],
  ];
  const d = detail.find(([p]) => path.startsWith(p));
  return d ? d[1] : "overview";
}
