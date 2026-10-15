/** Parent app vocabulary. The guardian, children and feed come from the API. */

export const PARENT_TABS = [
  { id: "home", label: "Home", icon: "home", href: "/parent" },
  { id: "track", label: "Track", icon: "near_me", href: "/parent/track" },
  { id: "alerts", label: "Alerts", icon: "notifications", href: "/parent/alerts" },
  { id: "history", label: "History", icon: "history", href: "/parent/history" },
  { id: "profile", label: "Profile", icon: "person", href: "/parent/profile" },
] as const;

/**
 * Time-of-day greeting on the parent home screen.
 *
 * Read in the school's timezone, not the device's — a parent travelling abroad
 * should still be greeted against the morning their child's bus is running.
 */
export function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const NOTIFICATION_FILTERS = ["All", "Transport", "Attendance", "Alerts"] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

export const PREFERENCE_ROWS = [
  { id: "alerts", label: "Boarding and drop alerts", sub: "Push notification at every scan" },
  { id: "absence", label: "Delay and route changes", sub: "When the bus runs late or reroutes" },
  { id: "digest", label: "Weekly summary", sub: "Friday evening recap of the week" },
] as const;

export type PreferenceId = (typeof PREFERENCE_ROWS)[number]["id"];

/** Format a 10-digit number as `98480 12345`. */
export const formatPhone = (digits: string): string =>
  digits.replace(/(\d{5})(\d+)/, "$1 $2");
