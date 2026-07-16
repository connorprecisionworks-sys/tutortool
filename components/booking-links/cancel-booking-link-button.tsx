"use client";

import { useRouter } from "next/navigation";
import { cancelBookingLinkAction } from "@/app/tutor/booking-links/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function CancelBookingLinkButton({ bookingLinkId }: { bookingLinkId: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    cancelBookingLinkAction,
    "Cancel this booking link? The link will stop working for anyone who has it.",
    () => router.refresh()
  );

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(bookingLinkId)}
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-text">{error}</p>}
    </span>
  );
}
