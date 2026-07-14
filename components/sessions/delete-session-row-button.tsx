"use client";

import { useRouter } from "next/navigation";
import { deleteSessionAction } from "@/app/tutor/sessions/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteSessionRowButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(deleteSessionAction, "Delete this session? This can't be undone.", () =>
    router.refresh()
  );

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(sessionId)}
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-xs text-text">{error}</p>}
    </span>
  );
}
