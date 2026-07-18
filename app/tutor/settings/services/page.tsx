import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { ServiceActiveToggle } from "@/components/settings/service-active-toggle";
import { DeleteServiceRowButton } from "@/components/settings/delete-service-row-button";
import { ServiceReorderButtons } from "@/components/settings/service-reorder-buttons";

export default async function ServicesPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("tutor_id", tutor.id)
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <PageHeader
        title="Services"
        description="Named, priced offerings. Pick one when logging a session to bill its flat price instead of your hourly rate. This order is also how they appear on your public page."
        action={
          <div className="flex items-center gap-3">
            <Link href="/tutor/settings">
              <Button variant="ghost" size="sm">
                Back to settings
              </Button>
            </Link>
            <Link href="/tutor/settings/services/new">
              <Button>Add service</Button>
            </Link>
          </div>
        }
      />

      {!services || services.length === 0 ? (
        <EmptyState
          message="No services yet. Add one to offer a flat-priced session, like a diagnostic assessment."
          action={
            <Link href="/tutor/settings/services/new">
              <Button>Add service</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="rtable w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Service</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 text-right font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={s.id} className="border-t border-border hover:bg-hover">
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <ServiceReorderButtons serviceId={s.id} isFirst={i === 0} isLast={i === services.length - 1} />
                      <div>
                        <Link href={`/tutor/settings/services/${s.id}`} className="font-medium">
                          {s.name}
                        </Link>
                        {s.description && <p className="mt-0.5 text-xs text-text-tertiary">{s.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text-secondary" data-label="Duration">
                    {s.duration_minutes} min
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums" data-label="Price">
                    {formatCents(s.price_cents)}
                  </td>
                  <td className="px-5 py-3" data-label="Status">
                    <ServiceActiveToggle serviceId={s.id} isActive={s.is_active} />
                  </td>
                  <td className="cell-action px-5 py-3 text-right">
                    <DeleteServiceRowButton serviceId={s.id} serviceName={s.name} />
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
