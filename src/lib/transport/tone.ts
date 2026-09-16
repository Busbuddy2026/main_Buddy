/** Status tones. Colour carries status only — never decoration (README §8). */
export type ToneKind = "ontime" | "delayed" | "offline" | "good" | "bad";

export interface Tone {
  bg: string;
  fg: string;
  dot: string;
}

export const TONE: Record<ToneKind, Tone> = {
  ontime: { bg: "#e8f0fe", fg: "#1558b8", dot: "#1a73e8" },
  delayed: { bg: "#fef7e0", fg: "#8f5b00", dot: "#f29900" },
  offline: { bg: "#f1f3f4", fg: "#5f6672", dot: "#9aa0a6" },
  good: { bg: "#e6f4ea", fg: "#186c33", dot: "#1e8e3e" },
  bad: { bg: "#fce8e6", fg: "#c5221f", dot: "#d93025" },
};

export interface PillSpec extends Tone {
  label: string;
}

export const pill = (label: string, kind: ToneKind): PillSpec => ({
  label,
  ...TONE[kind],
});

/** Attendance status → tone. */
export const STATUS_KIND: Record<string, ToneKind> = {
  Boarded: "good",
  Dropped: "ontime",
  Absent: "bad",
  Pending: "offline",
};

export const STATUS_GLYPH: Record<string, string> = {
  Boarded: "check_circle",
  Dropped: "check_circle",
  Pending: "radio_button_unchecked",
  Absent: "remove_circle_outline",
};

/** Zero-pad a sequence number for display. */
export const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
