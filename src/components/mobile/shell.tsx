"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/transport/ui";

/*
 * Shared chrome for the two mobile products (parent and crew).
 *
 * The prototypes are drawn inside a 412px device mock. On a phone — where these
 * actually run as a PWA — the frame would be chrome the user never sees, so it
 * only appears from `sm` up; below that the app is full-bleed.
 */

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-line-soft sm:box-border sm:px-4 sm:pb-10 sm:pt-[26px]">
      <div className="relative flex min-h-screen w-full flex-col bg-surface sm:min-h-[820px] sm:max-w-[412px] sm:overflow-hidden sm:rounded-[30px] sm:shadow-[0_18px_50px_rgba(16,24,40,.16)]">
        {children}
      </div>
    </div>
  );
}

/** Cosmetic status bar from the prototype's device mock. */
export function StatusBar({ clock, showWifi = true }: { clock: string; showWifi?: boolean }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-between px-[22px] pb-1 pt-3 font-mono text-xs font-semibold text-ink"
    >
      <span>{clock}</span>
      <span className="flex items-center gap-[5px]">
        <Icon name="signal_cellular_alt" size={15} />
        {showWifi ? <Icon name="wifi" size={15} /> : null}
        <Icon name="battery_full" size={15} />
      </span>
    </div>
  );
}

export function PhoneBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-h-0 flex-1 overflow-auto ${className}`}>{children}</div>;
}

/** Bottom sheet used by both apps for the log-out confirm. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 z-[900] flex items-end bg-[rgba(16,24,40,0.45)]"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[26px] bg-surface px-[22px] pb-[26px] pt-6 sm:rounded-b-[30px]"
      >
        <div className="text-lg font-semibold tracking-[-0.02em]">{title}</div>
        <p className="mt-2 text-[13px] leading-[1.5] text-muted text-pretty">{body}</p>
        <div className="mt-5 grid gap-[9px]">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[14px] bg-critical py-[15px] text-sm font-semibold text-white hover:bg-critical-hover"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[14px] border border-line py-[15px] text-sm font-semibold hover:bg-[#fafbfc]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
