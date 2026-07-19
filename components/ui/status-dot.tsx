import clsx from "clsx";

export type StatusKind =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "void"
  | "logged"
  | "billed"
  | "active"
  | "revoked"
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled";

export const STATUS_LABELS: Record<StatusKind, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  logged: "Logged",
  billed: "Billed",
  active: "Active",
  revoked: "Revoked",
  requested: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const FILLED: StatusKind[] = ["paid", "confirmed", "billed", "active"];
const HOLLOW: StatusKind[] = ["draft", "requested"];
const BOLD: StatusKind[] = ["overdue", "declined", "revoked", "cancelled"];

export function StatusDot({ status, label }: { status: StatusKind; label?: string }) {
  const filled = FILLED.includes(status);
  const hollow = HOLLOW.includes(status);
  const bold = BOLD.includes(status);

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          filled || bold ? "bg-text" : hollow ? "border border-text-tertiary bg-transparent" : "bg-text-secondary"
        )}
      />
      <span className={clsx(bold ? "font-semibold text-text" : "text-text-secondary")}>
        {label ?? STATUS_LABELS[status]}
      </span>
    </span>
  );
}
