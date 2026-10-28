/**
 * Loading placeholders: the page's shape in soft grey, gently pulsing, while
 * its data is on the way. Server-safe (no client code).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-chip bg-neutral-tint ${className}`} />;
}

/** The admin content area while a page loads: a title, a stat row and a table. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-control" />
      </div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** A phone app screen (parent, crew) while it loads: a header card and a few rows. */
export function MobileSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3.5 p-4">
      <Skeleton className="h-40 w-full rounded-card" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-card" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** A card body still loading: a spinner and a line of text. */
export function LoadingBlock({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2.5 px-5 py-8 text-[12.5px] text-faint ${className}`}>
      <Spinner />
      {label}
    </div>
  );
}

/** A small spinning ring in the current text colour. */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
}
