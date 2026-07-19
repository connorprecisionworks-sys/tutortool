import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { AvailabilityManager } from "@/components/schedule/availability-manager";
import { AvailabilityBlocksManager } from "@/components/schedule/availability-blocks-manager";
import { BookingRequests, type PendingBooking } from "@/components/schedule/booking-requests";
import { CancelBookingButton } from "@/components/schedule/cancel-booking-button";
import { approveBookingAction, declineBookingAction } from "@/app/tutor/schedule/actions";
import { formatBookingWhen, nowAsStoredWallClockIso } from "@/lib/scheduling";

export default async function SchedulePage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: availability }, { data: blocks }, { data: requested }, { data: confirmed }] = await Promise.all([
    supabase.from("availability").select("*").eq("tutor_id", tutor.id).order("weekday"),
    supabase.from("availability_blocks").select("*").eq("tutor_id", tutor.id).order("start_date"),
    supabase
      .from("bookings")
      .select("*, clients(student_name)")
      .eq("tutor_id", tutor.id)
      .eq("status", "requested")
      .order("requested_start"),
    supabase
      .from("bookings")
      .select("*, clients(student_name)")
      .eq("tutor_id", tutor.id)
      .eq("status", "confirmed")
      .gte("requested_start", nowAsStoredWallClockIso())
      .order("requested_start")
      .limit(10),
  ]);

  const pendingBookings: PendingBooking[] = (requested ?? []).map((b) => ({
    id: b.id,
    student_name: (b.clients as unknown as { student_name: string } | null)?.student_name ?? "—",
    requested_start: b.requested_start,
    duration_minutes: b.duration_minutes,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Set your weekly open hours and manage booking requests from parents."
      />

      <Card>
        <h2 className="mb-4 text-sm font-semibold">Weekly availability</h2>
        <AvailabilityManager availability={availability ?? []} />
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Blocked dates</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Vacations or one-off closures — booking never offers a time inside a blocked date.
        </p>
        <AvailabilityBlocksManager blocks={blocks ?? []} />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold">Pending requests</h2>
        <BookingRequests
          bookings={pendingBookings}
          approveAction={approveBookingAction}
          declineAction={declineBookingAction}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold">Upcoming confirmed bookings</h2>
        {!confirmed || confirmed.length === 0 ? (
          <p className="text-sm text-text-secondary">Nothing on the calendar yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {confirmed.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {(b.clients as unknown as { student_name: string } | null)?.student_name ?? "—"}
                  </p>
                  <p className="text-text-secondary">
                    {formatBookingWhen(b.requested_start)} · {b.duration_minutes} min
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusDot status="confirmed" />
                  <CancelBookingButton bookingId={b.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
