import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/brand/logo";
import { formatCents } from "@/lib/money";

interface PublicTutorService {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
}

interface PublicTutorProfile {
  found: boolean;
  name?: string;
  bio?: string | null;
  subjects?: string | null;
  services?: PublicTutorService[];
  booking_token?: string | null;
}

export default async function PublicTutorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_tutor_profile", { p_handle: handle });
  if (error) {
    // Logged, not shown: the visitor still sees the same calm "not found"
    // card below (no useful action they could take from a raw DB error),
    // but this line means an infra hiccup here is distinguishable from a
    // legitimately unpublished handle in the server logs.
    console.error(`get_public_tutor_profile(${handle}) failed:`, error.message);
  }
  const profile = data as unknown as PublicTutorProfile;

  if (!profile?.found) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <Mark className="mx-auto mb-4 h-6" />
          <h1 className="mb-1 text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-text-secondary">This tutor page doesn&apos;t exist or isn&apos;t published.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <Mark className="mb-6 h-6" />
      <h1 className="text-2xl font-semibold sm:text-3xl">{profile.name}</h1>
      {profile.subjects && <p className="mt-1 text-sm text-text-secondary">{profile.subjects}</p>}
      {profile.bio && <p className="mt-4 text-sm leading-relaxed text-text sm:text-base">{profile.bio}</p>}

      <div className="mt-8 space-y-3">
        {(profile.services ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No services listed yet.</p>
        ) : (
          profile.services!.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{s.name}</p>
                {s.description && <p className="mt-0.5 text-sm text-text-secondary">{s.description}</p>}
                <p className="mt-1 text-xs text-text-tertiary">
                  {s.duration_minutes} min
                  {s.price_cents != null && ` · ${formatCents(s.price_cents)}`}
                </p>
              </div>
              <Link href={`/t/${handle}/book/${s.id}`} className="shrink-0">
                <Button size="sm">Book</Button>
              </Link>
            </Card>
          ))
        )}
      </div>

      {/* C3: availability-driven booking (per-service, above) is the default
          path. A manually-created booking link (Q2's specific offered
          slots, or a B4 standing link) stays available as an optional
          secondary override — surfaced quietly, not as the primary CTA. */}
      {profile.booking_token && (
        <div className="mt-8 border-t border-border pt-6">
          <Link href={`/book/${profile.booking_token}`} className="text-sm text-text-secondary underline hover:text-text">
            Or see specific times offered by {profile.name}
          </Link>
        </div>
      )}

      <p className="mt-12 text-center text-xs text-text-tertiary">Slate — Back office for tutors.</p>
    </div>
  );
}
