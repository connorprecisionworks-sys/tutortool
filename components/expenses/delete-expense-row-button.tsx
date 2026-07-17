"use client";

import { useRouter } from "next/navigation";
import { deleteExpenseAction } from "@/app/tutor/expenses/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteExpenseRowButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    deleteExpenseAction,
    "Delete this expense? This can't be undone.",
    () => router.refresh()
  );

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(expenseId)}
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-text">{error}</p>}
    </span>
  );
}
