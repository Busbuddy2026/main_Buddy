"use client";

import { useId, useRef, type ReactNode } from "react";

/*
 * Boxed code entry for the OTP and PIN screens.
 *
 * The boxes are presentational; a single transparent input sits over them and
 * holds the value. That input is what makes the field autofillable — iOS and
 * Android surface the SMS code for `autocomplete="one-time-code"`, password
 * managers can fill the crew PIN, and paste and hardware keyboards work. The
 * on-screen keypad writes to the same value, so both routes stay in sync.
 */

export interface CodeInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Fired when the user completes the code — not on a prefilled mount. */
  onComplete?: (value: string) => void;
  /** Render filled boxes as dots rather than digits. */
  masked?: boolean;
  error?: boolean;
  label: string;
  autoComplete: "one-time-code" | "current-password";
  className?: string;
}

export function CodeInput({
  length,
  value,
  onChange,
  onComplete,
  masked = false,
  error = false,
  label,
  autoComplete,
  className = "",
}: CodeInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handle = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => handle(e.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        maxLength={length}
        aria-invalid={error || undefined}
        // Covers the boxes so a tap anywhere focuses it. 16px keeps iOS from
        // zooming the viewport on focus.
        className="absolute inset-0 z-10 w-full cursor-pointer bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none"
      />

      <div
        aria-hidden
        className="flex gap-[9px]"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length }, (_, i) => {
          const ch = value[i] ?? "";
          const filled = Boolean(ch);
          return (
            <Box key={i} filled={filled} masked={masked} error={error}>
              {masked ? null : ch}
            </Box>
          );
        })}
      </div>
    </div>
  );
}

function Box({
  children,
  filled,
  masked,
  error,
}: {
  children: ReactNode;
  filled: boolean;
  masked: boolean;
  error: boolean;
}) {
  const borderColor = error
    ? "#f7c8c4"
    : filled
      ? masked
        ? "#16181b"
        : "#1a73e8"
      : "#e4e7eb";

  return (
    <div
      className="grid flex-1 place-items-center rounded-[13px] border-[1.5px] font-mono text-[22px] font-semibold"
      style={{
        aspectRatio: masked ? "1 / 1.1" : "1 / 1.15",
        borderColor,
        background: filled ? (masked ? "#f6f7f9" : "#f7faff") : "#fff",
      }}
    >
      {masked ? (
        <span
          className="size-[13px] rounded-full"
          style={{ background: filled ? "#16181b" : "#e4e7eb" }}
        />
      ) : (
        children
      )}
    </div>
  );
}
