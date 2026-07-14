import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getLinkedStudents } from "@/lib/auth/linked-students";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";
import { BookingRequestForm } from "@/components/schedule/booking-request-form";
import { formatBookingWhen } from "@/lib/scheduling";

export default async function ParentSchedulePage() {
  const parentUser = await requireParent();
  const supabase = await createClient();

  const students = await getLinkedStudents(supabase, parentUser.id);

  if (students.length === 0) {
    return (
      <div>
        <PageHeader title="Schedule" description="Request or book time depending on how your tutor works." />
        <EmptyState message="Link your child's account from Home to see scheduling here." />
      </div>
    );
  }

  const studentIds = students.map((s) => s.id);
  const studentNames = new Map(students.map((s) => [s.id, s.name]));

  // `bookings` only depends on studentIds (known already), so it doesn't
  // need to wait on `clients` — run them concurrently. `availability`
  // genuinely depends on tutorIds, which only exists once `clients` has
  // resolved, so it stays a second round trip.
  const [{ data: clients }, { data: bookings }] = await Promise.all([
    supabase.from("clients").select("id, tutor_id, scheduling_mode").in("id", studentIds),
    supabase
      .from("bookings")
      .select("*")
      .in("student_id", studentIds)
      .order("requested_start", { ascending: false }),
  ]);

  const tutorIds = [...new Set((clients ?? []).map((c) => c.tutor_id))];

  const { data: availability } = tutorIds.length
    ? await supabase.from("availability").select("*").in("tutor_id", tutorIds)
    : { data: [] };

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" description="Request or book time depending on how your tutor works." />

      {(clients ?? []).map((client) => {
        const name = studentNames.get(client.id) ?? "Your child";
        const tutorAvailability = (availability ?? []).filter((a) => a.tutor_id === client.tutor_id);

        return (
          <Card key={client.id}>
            <h2 className="mb-3 text-sm font-semibold">{name}</h2>
            {client.scheduling_mode === "message" ? (
              <p className="text-sm text-text-secondary">
                Your tutor schedules sessions manually — reach out to them directly to set up time.
              </p>
            ) : (
              <BookingRequestForm
                studentId={client.id}
                mode={client.scheduling_mode as "request" | "calendar"}
                availability={tutorAvailability}
              />
            )}
          </Card>
        );
      })}

      <Card>
        <h2 className="mb-4 text-sm font-semibold">Your requests</h2>
        {!bookings || bookings.length === 0 ? (
          <p className="text-sm text-text-secondary">No booking requests yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{studentNames.get(b.student_id) ?? "—"}</p>
                  <p className="text-text-secondary">
                    {formatBookingWhen(b.requested_start)} · {b.duration_minutes} min
                  </p>
                </div>
                <StatusDot status={b.status as StatusKind} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
