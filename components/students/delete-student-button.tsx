"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteStudentAction } from "@/app/tutor/students/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteStudentButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    deleteStudentAction,
    `Delete ${studentName}? This can't be undone.`,
    () => {
      router.push("/tutor/students");
      router.refresh();
    }
  );

  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={() => run(studentId)}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && <p className="mt-2 max-w-sm text-sm text-text">{error}</p>}
    </div>
  );
}
