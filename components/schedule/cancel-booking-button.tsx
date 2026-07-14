"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "@/app/tutor/schedule/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    cancelBookingAction,
    "Cancel this booking? The session it created won't be deleted automatically.",
    () => router.refresh()
  );

  return (
    <span>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(bookingId)}>
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
      {error && <p className="mt-1 text-xs text-text">{error}</p>}
    </span>
  );
}
