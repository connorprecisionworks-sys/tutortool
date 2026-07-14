"use client";

import { useRouter } from "next/navigation";
import { deleteStudentAction } from "@/app/tutor/students/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteStudentRowButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    deleteStudentAction,
    `Delete ${studentName}? This can't be undone.`,
    () => router.refresh()
  );

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(studentId)}
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-text">{error}</p>}
    </span>
  );
}
