"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteResourceAction } from "@/app/tutor/resources/actions";

export function DeleteResourceButton({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this resource?")) return;
        startTransition(async () => {
          await deleteResourceAction(resourceId);
          router.refresh();
        });
      }}
      className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
