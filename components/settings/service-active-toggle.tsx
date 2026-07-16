"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusDot } from "@/components/ui/status-dot";
import { setServiceActiveAction } from "@/app/tutor/settings/services/actions";

export function ServiceActiveToggle({ serviceId, isActive }: { serviceId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setServiceActiveAction(serviceId, !isActive);
          router.refresh();
        })
      }
      className="disabled:opacity-50"
      title={isActive ? "Click to deactivate" : "Click to reactivate"}
    >
      <StatusDot status={isActive ? "active" : "revoked"} label={isActive ? "Active" : "Inactive"} />
    </button>
  );
}
