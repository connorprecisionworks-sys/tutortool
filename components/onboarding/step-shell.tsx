import Link from "next/link";

export function StepShell({
  stepNumber,
  totalSteps,
  title,
  description,
  skipHref,
  children,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  skipHref?: string;
  children: React.ReactNode;
}) {
  const progressPct = Math.round((stepNumber / totalSteps) * 100);

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary">
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
      <p className="mt-1.5 text-sm text-text-secondary">{description}</p>

      <div className="mt-6">{children}</div>

      {skipHref && (
        <div className="mt-6 text-center">
          <Link href={skipHref} className="text-xs text-text-tertiary hover:text-text">
            Skip for now
          </Link>
        </div>
      )}
    </div>
  );
}
