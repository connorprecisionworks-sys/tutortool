import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TERMS_DOC, PRIVACY_DOC } from "@/lib/legal/docs";
import { safeNext } from "@/lib/auth/safe-redirect";
import { AcceptTermsCard } from "./accept-terms-card";

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { next } = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <AcceptTermsCard
        termsVersion={TERMS_DOC.version}
        termsEffectiveDate={TERMS_DOC.effectiveDate}
        privacyVersion={PRIVACY_DOC.version}
        privacyEffectiveDate={PRIVACY_DOC.effectiveDate}
        next={safeNext(next)}
      />
    </div>
  );
}
