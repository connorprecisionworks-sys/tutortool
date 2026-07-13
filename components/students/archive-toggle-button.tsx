"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setStudentArchivedAction } from "@/app/tutor/students/actions";

export function ArchiveToggleButton({ studentId, archived }: { studentId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setStudentArchivedAction(studentId, !archived);
          router.refresh();
        })
      }
    >
      {pending ? "Saving…" : archived ? "Unarchive" : "Archive"}
    </Button>
  );
}
