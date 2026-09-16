"use client";

import type { ReactNode } from "react";

const CONTROL =
  "w-full box-border rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(26,115,232,0.14)]";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold tracking-[0.03em] text-faint">{children}</div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono = false,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${CONTROL} ${mono ? "font-mono" : ""} placeholder:text-disabled ${className}`}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Compact variant used inside the stop and fleet builders. */
export const COMPACT =
  "w-full box-border rounded-[9px] border border-line bg-surface px-2.5 py-[9px] text-[12.5px] text-ink outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(26,115,232,0.14)]";

export function MiniButton({
  icon,
  title,
  onClick,
  danger = false,
  color,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid size-6 shrink-0 place-items-center rounded-[7px] border border-line ${
        danger ? "hover:bg-critical-tint" : "hover:bg-neutral-tint"
      }`}
    >
      <span
        className="material-symbols-rounded"
        style={{ fontSize: 15, color: color ?? (danger ? "#c5221f" : "#5f6672") }}
        aria-hidden
      >
        {icon}
      </span>
    </button>
  );
}
