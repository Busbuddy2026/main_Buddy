import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Bus Buddy marketing primitives.
 *
 * Server components — the site is static, so only the pieces that actually
 * animate or hold state opt into the client.
 */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-[26px] ${className}`}>{children}</div>;
}

/** Every section closes with the same hairline (handoff: "Dividers"). */
export function Section({
  children,
  className = "",
  tone = "dark",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "dark" | "paper";
  id?: string;
}) {
  const paper = tone === "paper" ? "bg-bb-paper text-bb-ink" : "";
  return (
    <section
      id={id}
      className={`border-b border-bb-line ${paper} ${id ? "scroll-mt-20" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  tone = "dark",
  className = "",
}: {
  children: ReactNode;
  tone?: "dark" | "paper";
  className?: string;
}) {
  const color = tone === "paper" ? "text-bb-paper-eyebrow" : "text-bb-eyebrow";
  return (
    <div
      className={`font-code text-[10px] font-medium uppercase tracking-[0.2em] ${color} ${className}`}
    >
      {children}
    </div>
  );
}

/** Mono is for labels, numbers, IDs and timestamps — never for prose. */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-code ${className}`}>{children}</span>;
}

export function SectionTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`mt-5 text-[clamp(28px,3.8vw,48px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-balance ${className}`}
    >
      {children}
    </h2>
  );
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`mt-[18px] text-[clamp(15px,1.4vw,17px)] font-light leading-[1.65] text-bb-muted-2 text-pretty ${className}`}
    >
      {children}
    </p>
  );
}

/** The 200-weight italic second line that every page headline uses. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="font-extralight italic">{children}</span>;
}

const SIZES = {
  md: "px-[26px] py-[15px] text-[14px]",
  sm: "px-[18px] py-[11px] text-[12.5px]",
  header: "px-[17px] py-[10px] text-[12.5px]",
} as const;

type ButtonSize = keyof typeof SIZES;

function buttonClass(variant: "solid" | "ghost", size: ButtonSize) {
  const shape = `inline-flex items-center justify-center rounded-full font-semibold ${SIZES[size]}`;
  return variant === "solid"
    ? `${shape} bg-bb-text text-bb-bg hover:bg-bb-text-2 hover:text-bb-bg`
    : `${shape} border border-bb-edge-2 text-bb-text hover:border-bb-hover-2 hover:text-bb-text`;
}

export function ButtonLink({
  href,
  children,
  variant = "solid",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost";
  size?: ButtonSize;
  className?: string;
}) {
  const cls = `${buttonClass(variant, size)} ${className}`;
  // In-page anchors stay plain <a>; the router has nothing to do for them.
  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/**
 * Grouped list or grid whose 1px gaps read as hairlines: the gap shows the
 * `line` background through a grid of `surface` cells (handoff: "Dividers").
 */
export function HairGrid({
  children,
  className = "",
  min,
}: {
  children: ReactNode;
  className?: string;
  /** Minimum column width for an auto-fit grid; omit for a single column. */
  min?: number;
}) {
  // The track sizing is an inline style, not an arbitrary class: Tailwind only
  // generates utilities it can read as complete strings in the source, so an
  // interpolated `grid-cols-[…]` silently produces no CSS at all.
  return (
    <div
      style={
        min ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` } : undefined
      }
      className={`${min ? "grid" : "flex flex-col"} gap-px overflow-hidden rounded-[18px] border border-bb-line bg-bb-line ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCell({
  value,
  label,
  className = "",
}: {
  value: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={`bg-bb-surface px-[26px] py-[30px] ${className}`}>
      <div className="font-code text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.04em]">
        {value}
      </div>
      <div className="mt-2 text-[12.5px] text-bb-muted-3">{label}</div>
    </div>
  );
}
