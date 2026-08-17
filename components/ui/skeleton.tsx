import clsx from "clsx";

/**
 * Loading placeholders.
 *
 * These exist for speed, not decoration. With no loading.tsx in the tree,
 * Next.js has to finish every query in the layout AND the page before it can
 * send a single byte — the browser sits on a white screen for the length of
 * the slowest round-trip. A loading.tsx turns that into a streamed response:
 * the shell paints immediately and the data swaps in when it lands.
 *
 * Which means the skeleton's real job is to occupy the SAME space the real
 * content will. A placeholder of the wrong height just moves the layout
 * shift later instead of removing it, and a jumping page reads as slower
 * than a blank one — so every block below is sized off the component it
 * stands in for.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("skeleton rounded-md bg-hover", className)}
      aria-hidden
    />
  );
}

/** Page title + description + action button, matching ui/page-header.tsx. */
export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="w-full max-w-md">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />}
    </div>
  );
}

/** The pill row from ui/status-filter-tabs.tsx. */
export function FilterTabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-4 flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Table placeholder. `columns` should match the real header count and
 * `widths` its rough column proportions, or the swap will visibly reflow.
 */
export function TableSkeleton({
  columns = 5,
  rows = 6,
  widths,
}: {
  columns?: number;
  rows?: number;
  widths?: string[];
}) {
  const w = widths ?? Array.from({ length: columns }, () => "w-24");
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-4 border-b border-border bg-surface-sunken px-5 py-3">
        {w.map((cls, i) => (
          <Skeleton key={i} className={clsx("h-3.5", cls)} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-t border-border px-5 py-3.5 first:border-t-0">
          {w.map((cls, i) => (
            <Skeleton
              key={i}
              className={clsx("h-4", cls)}
              // Stagger the shimmer down the rows so it reads as one surface
              // filling in, rather than six strips pulsing in lockstep.
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The stat tile row used on the dashboard and Insights. */
export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

/** A generic panel, for dashboard cards and settings sections. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-border bg-surface p-5", className)}>
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx("mt-3 h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
