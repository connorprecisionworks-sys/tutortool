import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { BookingLinkForm } from "@/components/booking-links/booking-link-form";
import { OpenAvailabilityLinkForm } from "@/components/booking-links/open-availability-link-form";

export default async function NewBookingLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  // Open availability (standing, zero-typing) is the default now — the
  // typing-heavy "specific times" form is the explicit opt-in via
  // ?mode=fixed. ?mode=open is kept working for old bookmarked links.
  const isOpenAvailability = mode !== "fixed";

  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: clients }, { data: services }, { count: availabilityCount }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).eq("archived", false).order("student_name"),
    supabase.from("services").select("*").eq("tutor_id", tutor.id).eq("is_active", true).order("name"),
    supabase.from("availability").select("id", { count: "exact", head: true }).eq("tutor_id", tutor.id),
  ]);

  return (
    <div>
      <PageHeader
        title="New booking link"
        description={
          isOpenAvailability
            ? "A standing, reusable link — the parent picks any open time inside your weekly availability, any number of times."
            : "Offer a few time slots. The parent opens the link, picks one, and it lands on your schedule — no back-and-forth."
        }
      />

      <div className="mb-4 flex gap-2 text-sm">
        <Link
          href="/tutor/booking-links/new?mode=fixed"
          className={!isOpenAvailability ? "font-medium text-text" : "text-text-secondary hover:text-text"}
        >
          Offer specific times
        </Link>
        <span className="text-text-tertiary">·</span>
        <Link
          href="/tutor/booking-links/new"
          className={isOpenAvailability ? "font-medium text-text" : "text-text-secondary hover:text-text"}
        >
          Open availability (standing)
        </Link>
      </div>

      <Card className="max-w-2xl">
        {isOpenAvailability ? (
          <OpenAvailabilityLinkForm
            clients={clients ?? []}
            services={services ?? []}
            hasAvailability={(availabilityCount ?? 0) > 0}
          />
        ) : (
          <BookingLinkForm clients={clients ?? []} services={services ?? []} />
        )}
      </Card>
    </div>
  );
}
