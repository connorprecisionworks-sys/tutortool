"use client";

import { useRouter } from "next/navigation";
import { deleteServiceAction } from "@/app/tutor/settings/services/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteServiceRowButton({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    deleteServiceAction,
    `Delete ${serviceName}? This only works if no session or booking has ever used it — deactivate instead if it has history.`,
    () => router.refresh()
  );

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(serviceId)}
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-text">{error}</p>}
    </span>
  );
}
