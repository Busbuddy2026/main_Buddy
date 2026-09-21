"use client";

import type { ReactNode } from "react";

/*
 * Shared chrome for the two mobile products (parent and crew).
 *
 * On a phone — where these actually run, installed to the home screen — the app
 * owns the whole viewport: the frame is exactly one screen tall, only the body
 * scrolls, and the tab bar stays put above the home indicator. From `sm` up
 * there is no phone to fill, so the same tree is drawn inside a 412px device
 * mock instead.
 *
 * Heights use `dvh`, not `vh`: on mobile Safari and Chrome `100vh` is the
 * viewport with the URL bar retracted, so a `100vh` app is always taller than
 * the screen and pushes its own bottom bar out of reach.
 */

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-line-soft sm:box-border sm:px-4 sm:pb-10 sm:pt-[26px]">
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface pt-[env(safe-area-inset-top)] sm:h-[820px] sm:max-h-[calc(100dvh-66px)] sm:max-w-[412px] sm:rounded-[30px] sm:pt-0 sm:shadow-[0_18px_50px_rgba(16,24,40,.16)]">
        {children}
      </div>
    </div>
  );
}

export function PhoneBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>
      {children}
    </div>
  );
}

/**
 * Sticky bottom chrome — the parent tab bar and the crew action bar.
 *
 * `safe-area-inset-bottom` is the home indicator on a gesture-nav phone; without
 * it the last row of controls sits underneath it and is hard to hit.
 */
export function PhoneFooter({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`shrink-0 border-t border-line-soft bg-surface pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Shown while the stored session is read back on mount.
 *
 * The server cannot know whether this device is signed in, so the first paint
 * is neither screen — without this the app flashes the login form at a parent
 * who is already signed in, on every single cold start.
 */
export function PhoneSplash() {
  return (
    <div className="grid flex-1 place-items-center" role="status" aria-label="Loading">
      <span className="size-7 animate-spin rounded-full border-2 border-line border-t-primary" />
    </div>
  );
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
        className="w-full rounded-t-[26px] bg-surface px-[22px] pt-6 pb-[calc(26px+env(safe-area-inset-bottom))] sm:rounded-b-[30px] sm:pb-[26px]"
      >
        <div className="text-lg font-semibold tracking-[-0.02em]">{title}</div>
        <p className="mt-2 text-[13px] leading-[1.5] text-muted text-pretty">{body}</p>
        <div className="mt-5 grid gap-[9px]">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 rounded-[14px] bg-critical py-[15px] text-sm font-semibold text-white hover:bg-critical-hover"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-[14px] border border-line py-[15px] text-sm font-semibold hover:bg-[#fafbfc]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
