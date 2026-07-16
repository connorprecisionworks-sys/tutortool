"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { confirmPendingStudentAction, mergePendingStudentAction } from "@/app/tutor/students/actions";

export function PendingStudentRow({
  studentId,
  studentName,
  otherStudents,
}: {
  studentId: string;
  studentName: string;
  otherStudents: { id: string; student_name: string }[];
}) {
  const router = useRouter();
  const [merging, setMerging] = useState(false);
  const [targetId, setTargetId] = useState(otherStudents[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{studentName}</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await confirmPendingStudentAction(studentId);
                if (result.error) setError(result.error);
                else router.refresh();
              });
            }}
          >
            Confirm
          </Button>
          {otherStudents.length > 0 && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setMerging((m) => !m)}>
              Merge…
            </Button>
          )}
        </div>
      </div>
      {merging && (
        <div className="flex items-center gap-2">
          <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="max-w-xs">
            {otherStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await mergePendingStudentAction(studentId, targetId);
                if (result.error) setError(result.error);
                else router.refresh();
              });
            }}
          >
            {pending ? "Merging…" : "Merge into this student"}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-text">{error}</p>}
    </li>
  );
}
