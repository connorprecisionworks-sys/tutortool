import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { CopyButton } from "@/components/ui/copy-button";
import { CancelBookingLinkButton } from "@/components/booking-links/cancel-booking-link-button";
import { bookingLink } from "@/lib/booking-link";

export default async function BookingLinksPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("booking_links")
    .select("*, clients(student_name), services(name)")
    .eq("tutor_id", tutor.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Booking Links"
        description="Offer a few time slots, send the link, and the parent picks one — no back-and-forth."
        action={
          <Link href="/tutor/booking-links/new">
            <Button>New booking link</Button>
          </Link>
        }
      />

      {!links || links.length === 0 ? (
        <EmptyState
          message="No booking links yet. Create one to let a parent pick a time from slots you offer."
          action={
            <Link href="/tutor/booking-links/new">
              <Button>New booking link</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">For</th>
                <th className="px-5 py-3 font-medium">Service</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Link</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-hover">
                  <td className="px-5 py-3">
                    {(l.clients as unknown as { student_name: string } | null)?.student_name ?? (
                      <span className="text-text-tertiary">Open — any new parent</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">
                    {(l.services as unknown as { name: string } | null)?.name ?? "Custom duration"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusDot status={l.status === "booked" ? "confirmed" : l.status === "cancelled" ? "cancelled" : "requested"} label={l.status === "open" ? "Open" : l.status === "booked" ? "Booked" : "Cancelled"} />
                  </td>
                  <td className="px-5 py-3">
                    {l.status === "open" ? (
                      <CopyButton value={bookingLink(l.token)} label="Copy link" copiedLabel="Copied" size="sm" />
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {l.status === "open" && <CancelBookingLinkButton bookingLinkId={l.id} />}
                    {l.status === "booked" && l.session_id && (
                      <Link href={`/tutor/sessions/${l.session_id}`} className="text-xs text-text-tertiary hover:text-text">
                        View session
                      </Link>
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
