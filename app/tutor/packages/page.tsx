import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";
import { PackagePublicToggle } from "@/components/packages/package-public-toggle";
import { formatCents } from "@/lib/money";

const STATUS_KIND: Record<string, StatusKind> = {
  pending_payment: "draft",
  active: "active",
  depleted: "billed",
  cancelled: "cancelled",
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  active: "Active",
  depleted: "Used up",
  cancelled: "Cancelled",
};

export default async function PackagesPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: packages } = await supabase
    .from("packages")
    .select("*, clients(student_name)")
    .eq("tutor_id", tutor.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Packages"
        description="Prepaid session blocks. Sessions logged against an active package draw down its balance instead of billing separately."
        action={
          <Link href="/tutor/packages/new">
            <Button>New package</Button>
          </Link>
        }
      />

      {!packages || packages.length === 0 ? (
        <EmptyState
          message="No packages yet. Sell a block of prepaid sessions to get started."
          action={
            <Link href="/tutor/packages/new">
              <Button>New package</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Package</th>
                <th className="px-5 py-3 font-medium">Balance</th>
                <th className="px-5 py-3 text-right font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-hover">
                  <td className="px-5 py-3">
                    {p.client_id == null
                      ? "General"
                      : ((p.clients as unknown as { student_name: string } | null)?.student_name ?? "—")}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{p.name}</td>
                  <td className="px-5 py-3 text-text-secondary">
                    {p.remaining_sessions} / {p.total_sessions} left
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatCents(p.price_cents)}</td>
                  <td className="px-5 py-3">
                    <StatusDot status={STATUS_KIND[p.status] ?? "draft"} label={STATUS_LABEL[p.status] ?? p.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.client_id == null ? (
                      p.status === "active" ? (
                        <PackagePublicToggle key={String(p.is_public)} packageId={p.id} initialIsPublic={p.is_public} />
                      ) : (
                        p.is_public && <span className="text-xs text-text-tertiary">Not shown — {STATUS_LABEL[p.status] ?? p.status}</span>
                      )
                    ) : (
                      p.status === "pending_payment" &&
                      p.purchase_invoice_id && (
                        <Link
                          href={`/tutor/invoices/${p.purchase_invoice_id}`}
                          className="text-xs text-text-tertiary hover:text-text"
                        >
                          View invoice
                        </Link>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
