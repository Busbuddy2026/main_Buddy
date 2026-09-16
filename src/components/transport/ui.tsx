"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { PillSpec } from "@/lib/transport/tone";

/* ── Icons ──────────────────────────────────────────────────────────────── */

export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}

/* ── Typography ─────────────────────────────────────────────────────────── */

/** Every number, ID, plate and timestamp is IBM Plex Mono (README §8). */
export function Mono({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`font-mono ${className}`} style={style}>
      {children}
    </span>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`text-[10.5px] font-semibold uppercase tracking-[0.04em] text-faint ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  style,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-surface ${padded ? "p-5" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  meta,
  action,
  className = "",
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-line-soft px-[18px] py-[14px] ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold tracking-[-0.01em]">{title}</div>
        {meta ? <div className="mt-0.5 text-[11.5px] text-faint">{meta}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-[15px] font-semibold tracking-[-0.01em]">{children}</div>;
}

/* ── Status pills ───────────────────────────────────────────────────────── */

export function StatusPill({ pill, className = "" }: { pill: PillSpec; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-[11px] py-[5px] text-[11.5px] font-semibold ${className}`}
      style={{ background: pill.bg, color: pill.fg }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: pill.dot }}
      />
      {pill.label}
    </span>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

export function PrimaryButton({
  children,
  onClick,
  icon,
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-control px-[14px] py-[9px] text-[12.5px] font-semibold text-white transition-colors ${
        disabled ? "cursor-not-allowed bg-neutral-tint text-disabled" : "bg-primary hover:bg-primary-hover"
      } ${className}`}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  icon,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-[13px] py-[8px] text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:text-disabled ${className}`}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-control bg-critical px-[14px] py-[9px] text-[12.5px] font-semibold text-white transition-colors hover:bg-critical-hover ${className}`}
    >
      {children}
    </button>
  );
}

/** 30px square icon button used in table action cells. */
export function IconButton({
  name,
  title,
  onClick,
  tone = "muted",
}: {
  name: string;
  title: string;
  onClick?: () => void;
  tone?: "muted" | "danger";
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`focus-ring grid size-[30px] shrink-0 place-items-center rounded-chip border border-line bg-surface transition-colors ${
        tone === "danger"
          ? "text-critical hover:border-critical-line hover:bg-critical-tint"
          : "text-muted hover:bg-canvas"
      }`}
    >
      <Icon name={name} size={16} />
    </button>
  );
}

/* ── Filters ────────────────────────────────────────────────────────────── */

export function SearchBox({
  value,
  onChange,
  placeholder,
  width = 250,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-control border border-line bg-surface px-3 py-[7px] focus-within:border-primary"
      style={{ width }}
    >
      <Icon name="search" size={18} className="text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-disabled"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="grid place-items-center text-faint hover:text-ink-2"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function Dropdown({
  value,
  options,
  onChange,
  open,
  onToggle,
  width = 170,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  open: boolean;
  onToggle: () => void;
  width?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width }}>
      <button
        type="button"
        onClick={onToggle}
        className="focus-ring flex w-full items-center gap-2 rounded-control border border-line bg-surface px-3 py-[8px] text-[12.5px] font-medium text-ink-2 hover:bg-canvas"
      >
        <span className="min-w-0 flex-1 truncate text-left">{value}</span>
        <Icon name={open ? "expand_less" : "expand_more"} size={17} className="text-faint" />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-[260px] w-full overflow-auto rounded-control border border-line bg-surface py-1"
          style={{ boxShadow: "var(--shadow-dropdown)" }}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className="block w-full px-3 py-[7px] text-left text-[12.5px] hover:bg-canvas"
              style={{
                background: o === value ? "#f1f3f4" : "#fff",
                fontWeight: o === value ? 600 : 500,
              }}
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring shrink-0 rounded-pill border px-[13px] py-[7px] text-[12.5px] font-medium transition-colors"
      style={{
        background: active ? "#16181b" : "#fff",
        color: active ? "#fff" : "#3c4149",
        borderColor: active ? "#16181b" : "#e4e7eb",
      }}
    >
      {label}
    </button>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5">{children}</div>;
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

export function TableWrap({ children, minWidth }: { children: ReactNode; minWidth: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={`border-b border-line-soft px-[18px] py-[11px] text-[11px] font-semibold uppercase tracking-[0.06em] text-faint ${className}`}
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`border-b border-line-rule px-[18px] py-[13px] align-middle text-[12.5px] text-ink-2 ${className}`}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}

export function EmptyState({
  icon = "search_off",
  title,
  body,
  onClear,
  clearLabel = "Clear filters",
}: {
  icon?: string;
  title: string;
  body?: string;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-neutral-tint text-faint">
        <Icon name={icon} size={22} />
      </div>
      <div className="text-[13.5px] font-semibold text-ink">{title}</div>
      {body ? <div className="max-w-[420px] text-[12.5px] text-muted">{body}</div> : null}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-[12.5px] font-medium text-primary hover:text-primary-hover"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

/* ── Misc ───────────────────────────────────────────────────────────────── */

export function Avatar({
  initial,
  size = 30,
  tone = "primary",
}: {
  initial: string;
  size?: number;
  tone?: "primary" | "neutral";
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: tone === "primary" ? "#e8f0fe" : "#f1f3f4",
        color: tone === "primary" ? "#1a73e8" : "#5f6672",
      }}
    >
      {initial}
    </span>
  );
}

export function ProgressBar({
  pct,
  color = "#1a73e8",
  height = 5,
  track = "#f1f3f4",
  className = "",
}: {
  pct: string;
  color?: string;
  height?: number;
  track?: string;
  className?: string;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-pill ${className}`}
      style={{ height, background: track }}
    >
      <div className="h-full rounded-pill" style={{ width: pct, background: color }} />
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-primary"
    >
      <Icon name="arrow_back" size={16} />
      {children}
    </Link>
  );
}

export function SoonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-[5px] bg-neutral-tint px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-faint ${className}`}
    >
      Coming soon
    </span>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 text-[13px] font-medium text-ink">{value}</div>
    </div>
  );
}

/** Vertical stack used by every page body. */
export function PageStack({ children, gap = 18 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="flex min-w-0 flex-col" style={{ gap }}>
      {children}
    </div>
  );
}
