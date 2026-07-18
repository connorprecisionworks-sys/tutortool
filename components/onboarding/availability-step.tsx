"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AvailabilityManager } from "@/components/schedule/availability-manager";
import type { Tables } from "@/lib/database.types";

export function AvailabilityStep({
  availability,
  nextHref,
}: {
  availability: Tables<"availability">[];
  nextHref: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <AvailabilityManager availability={availability} compact />
      <Button type="button" className="w-full" disabled={availability.length === 0} onClick={() => router.push(nextHref)}>
        Continue
      </Button>
    </div>
  );
}
