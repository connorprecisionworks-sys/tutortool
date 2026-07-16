import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Mark } from "@/components/brand/logo";
import { BookingConfirmForm } from "@/components/book/booking-confirm-form";
import { formatCents } from "@/lib/money";

interface BookingLinkPublicData {
  found: boolean;
  status?: "open" | "booked" | "cancelled" | "unavailable";
  tutor_name?: string;
  service_name?: string | null;
  service_price_cents?: number | null;
  service_duration_minutes?: number | null;
  needs_student_name?: boolean;
  slots?: { id: string; start_ts: string; duration_minutes: number }[];
}

export default async function BookingLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_booking_link_public", { p_token: token });
  const link = data as unknown as BookingLinkPublicData;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <Mark className="mb-4 h-6" />

        {!link?.found ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Link not found</h1>
            <p className="text-sm text-text-secondary">This booking link doesn&apos;t exist or was removed.</p>
          </>
        ) : link.status === "cancelled" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Link cancelled</h1>
            <p className="text-sm text-text-secondary">This booking link is no longer available.</p>
          </>
        ) : link.status === "booked" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Already booked</h1>
            <p className="text-sm text-text-secondary">
              This slot has already been booked. Reach out to {link.tutor_name} for another time.
            </p>
          </>
        ) : link.status === "unavailable" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">No longer available</h1>
            <p className="text-sm text-text-secondary">
              This link&apos;s service isn&apos;t offered anymore. Ask {link.tutor_name} for a new link.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold">Book with {link.tutor_name}</h1>
            <p className="mb-6 text-sm text-text-secondary">
              {link.service_name
                ? `${link.service_name} — ${formatCents(link.service_price_cents ?? 0)} (${link.service_duration_minutes} min)`
                : "Pick a time below."}
            </p>
            <BookingConfirmForm
              token={token}
              slots={link.slots ?? []}
              needsStudentName={Boolean(link.needs_student_name)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
