"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteSessionAction } from "@/app/tutor/sessions/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(deleteSessionAction, "Delete this session? This can't be undone.", () => {
    router.push("/tutor/sessions");
    router.refresh();
  });

  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={() => run(sessionId)}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && <p className="mt-2 text-sm text-text">{error}</p>}
    </div>
  );
}
