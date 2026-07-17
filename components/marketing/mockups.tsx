import { ReactNode } from "react";
import clsx from "clsx";
import { Mark } from "@/components/brand/logo";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";

/**
 * Framed illustrative panels styled from the real app's own tokens and
 * components (Card/Button/StatusDot classes, sidebar layout) — not stock
 * photography or fabricated screenshots. Names/numbers below are sample
 * data to demonstrate the UI, the same way any product marketing page
 * shows its own interface with placeholder content.
 */
function MockupFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-hidden rounded-xl border border-border bg-surface", className)}>
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-surface-sunken px-3">
        <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
        <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
        <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
      </div>
      {children}
    </div>
  );
}

const NAV_ITEMS = ["Dashboard", "Students", "Sessions", "Invoices", "Schedule"];

export function DashboardMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="flex">
        <div className="hidden w-32 shrink-0 border-r border-border bg-surface-sunken p-3 sm:block">
          <Mark className="mb-3 h-3.5" />
          <div className="space-y-0.5 text-[11px]">
            {NAV_ITEMS.map((item, i) => (
              <div
                key={item}
                className={clsx("rounded-md px-2 py-1.5", i === 0 ? "bg-hover font-medium text-text" : "text-text-secondary")}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-4">
          <p className="text-xs font-semibold text-text">Dashboard</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-[10px] text-text-secondary">Outstanding</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">$1,240.00</p>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-[10px] text-text-secondary">Billed this month</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">$3,860.00</p>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-[10px] text-text-secondary">Overdue</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">1</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11px] text-text-secondary">
              <span>Student</span>
              <span>Status</span>
            </div>
            {(
              [
                ["Maya Chen", "sent"],
                ["Owen Park", "paid"],
                ["Priya Nair", "overdue"],
              ] as [string, StatusKind][]
            ).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between px-3 py-2 text-[11px]">
                <span className="text-text">{name}</span>
                <StatusDot status={status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

export function InvoiceMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-text">Invoice — Maya Chen</p>
            <p className="text-[11px] text-text-secondary">Jul 1 – Jul 15</p>
          </div>
          <StatusDot status="sent" />
        </div>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[11px]">
          <div className="flex justify-between">
            <span className="text-text-secondary">Algebra II — 4 sessions</span>
            <span className="tabular-nums">$320.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Travel time</span>
            <span className="tabular-nums">$40.00</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold text-text">
          <span>Total</span>
          <span className="tabular-nums">$360.00</span>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-secondary">Send reminder</span>
          <span className="rounded-lg bg-accent px-2.5 py-1 text-[11px] text-accent-text">Mark paid</span>
        </div>
      </div>
    </MockupFrame>
  );
}

export function BookingLinkMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <Mark className="mb-2 h-4" />
        <p className="text-xs font-semibold text-text">Book with Jordan Reyes</p>
        <p className="mt-0.5 text-[11px] text-text-secondary">SAT Prep — $80.00 (60 min)</p>
        <div className="mt-3 space-y-1.5">
          {["Tue, Jul 22 · 4:00 PM", "Wed, Jul 23 · 5:30 PM", "Thu, Jul 24 · 4:00 PM"].map((slot) => (
            <div key={slot} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text">
              {slot}
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

export function ParentPortalMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">Home</p>
        <p className="text-[11px] text-text-secondary">Linked to Maya Chen.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border p-2.5">
            <p className="text-[10px] text-text-secondary">Next session</p>
            <p className="mt-1 text-[11px] font-medium text-text">Tue · 4:00 PM</p>
          </div>
          <div className="rounded-lg border border-border p-2.5">
            <p className="text-[10px] text-text-secondary">Balance</p>
            <p className="mt-1 text-[11px] font-medium tabular-nums text-text">$0.00</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border p-2.5 text-[11px] text-text-secondary">
          Session notes, resources, and invoices, all in one place.
        </div>
      </div>
    </MockupFrame>
  );
}

export function RatesMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">Services</p>
        <div className="mt-3 space-y-1.5">
          {[
            ["Algebra II", "$65/hr"],
            ["SAT Prep", "$80/hr"],
            ["Essay Coaching", "$70/hr"],
          ].map(([name, rate]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-[11px]">
              <span className="text-text">{name}</span>
              <span className="tabular-nums text-text-secondary">{rate}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

export function SessionLogMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">Sessions</p>
        <div className="mt-3 space-y-1.5">
          {(
            [
              ["Maya Chen", "Mon · 60 min", "logged"],
              ["Owen Park", "Tue · 45 min", "billed"],
              ["Priya Nair", "Wed · 60 min", "logged"],
            ] as [string, string, StatusKind][]
          ).map(([name, meta, status]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-[11px]">
              <div>
                <p className="text-text">{name}</p>
                <p className="text-text-tertiary">{meta}</p>
              </div>
              <StatusDot status={status} />
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

export function CancellationMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">Cancel session</p>
        <p className="mt-1 text-[11px] text-text-secondary">Maya Chen · Tue, Jul 22 · 4:00 PM</p>
        <div className="mt-3 space-y-1.5">
          <div className="rounded-lg border border-border bg-hover px-2.5 py-1.5 text-[11px] text-text">Issue a credit</div>
          <div className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text-secondary">Refund</div>
          <div className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text-secondary">Charge in full</div>
        </div>
      </div>
    </MockupFrame>
  );
}

export function PackageMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">10-Session Package</p>
        <p className="mt-1 text-[11px] text-text-secondary">Owen Park</p>
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full w-[60%] bg-accent" />
          </div>
          <p className="mt-1.5 text-[11px] text-text-secondary">6 of 10 sessions used</p>
        </div>
      </div>
    </MockupFrame>
  );
}

export function ExpenseMockup({ className }: { className?: string }) {
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">Expenses this year</p>
        <div className="mt-3 space-y-1.5">
          {[
            ["Mileage — 412 mi", "$237.94"],
            ["Workbooks", "$64.20"],
            ["SAT prep materials", "$112.00"],
          ].map(([name, amt]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-[11px]">
              <span className="text-text-secondary">{name}</span>
              <span className="tabular-nums text-text">{amt}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

export function InsightsMockup({ className }: { className?: string }) {
  const bars = [40, 65, 50, 80, 70, 95];
  return (
    <MockupFrame className={className}>
      <div className="p-4">
        <p className="text-xs font-semibold text-text">Revenue</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-text">$3,860.00</p>
        <div className="mt-3 flex h-16 items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-accent/70" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}
