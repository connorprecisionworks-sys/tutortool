import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Mark } from "@/components/brand/logo";
import { ServiceAvailabilityBookingForm } from "@/components/book/service-availability-booking-form";
import { formatCents } from "@/lib/money";

interface PublicServiceData {
  found: boolean;
  tutor_name?: string;
  service_name?: string;
  description?: string | null;
  duration_minutes?: number;
  price_cents?: number | null;
}

export default async function PublicServiceBookingPage({
  params,
}: {
  params: Promise<{ handle: string; serviceId: string }>;
}) {
  const { handle, serviceId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_service", { p_handle: handle, p_service_id: serviceId });
  if (error) {
    // Logged, not shown: same "calm not-found card either way, but
    // distinguishable in server logs" convention as /t/[handle]'s own
    // get_public_tutor_profile call — otherwise an infra hiccup here is
    // indistinguishable from a genuinely deleted service or bad link.
    console.error(`get_public_service(${handle}, ${serviceId}) failed:`, error.message);
  }
  const service = data as unknown as PublicServiceData;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <Mark className="mb-4 h-6" />

        {!service?.found ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Not available</h1>
            <p className="text-sm text-text-secondary">
              This service isn&apos;t offered anymore, or this tutor page isn&apos;t published.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold">Book with {service.tutor_name}</h1>
            <p className="mb-6 text-sm text-text-secondary">
              {service.service_name}
              {service.price_cents != null && ` — ${formatCents(service.price_cents)}`} ({service.duration_minutes}{" "}
              min)
            </p>
            <ServiceAvailabilityBookingForm
              handle={handle}
              serviceId={serviceId}
              durationMinutes={service.duration_minutes ?? 60}
            />
          </>
        )}
      </Card>
    </div>
  );
}
