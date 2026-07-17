import { formatCents } from "@/lib/money";

/** Plain-CSS monochrome bar chart — no charting library, matches the design system's "no gradients/no color" rule. */
export function RevenueBarChart({ bars }: { bars: { label: string; cents: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.cents));

  return (
    <div className="flex items-end gap-3 sm:gap-4" style={{ height: 140 }}>
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-2" style={{ height: "100%" }}>
          <span className="text-xs tabular-nums text-text-secondary">{formatCents(b.cents)}</span>
          <div
            className="w-full rounded-t-md bg-accent"
            style={{ height: `${Math.max(4, Math.round((b.cents / max) * 90))}px`, opacity: b.cents === 0 ? 0.15 : 1 }}
          />
          <span className="text-xs text-text-tertiary">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
