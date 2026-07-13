"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteSessionAction } from "@/app/tutor/sessions/actions";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this session? This can't be undone.")) return;
        startTransition(async () => {
          await deleteSessionAction(sessionId);
          router.push("/tutor/sessions");
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
