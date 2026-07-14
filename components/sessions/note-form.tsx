"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  saveSessionNoteAction,
  deleteSessionNoteAction,
  type NoteFormResult,
} from "@/app/tutor/sessions/notes-actions";
import type { Tables } from "@/lib/database.types";

const initialState: NoteFormResult = {};

export function NoteForm({ sessionId, note }: { sessionId: string; note: Tables<"session_notes"> | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveSessionNoteAction, initialState);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <Textarea
        name="body"
        defaultValue={note?.body ?? ""}
        rows={4}
        placeholder="What did you work on this session?"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="shared"
          defaultChecked={note?.shared ?? false}
          className="h-4 w-4 rounded border-border"
        />
        Share this note with the parent
      </label>
      {state.error && <p className="text-sm text-text">{state.error}</p>}
      {state.success && <p className="text-sm text-text-secondary">Saved.</p>}
      {deleteError && <p className="text-sm text-text">{deleteError}</p>}
      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save note"}
        </Button>
        {note && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={deletePending}
            onClick={() => {
              if (!confirm("Delete this note?")) return;
              setDeleteError(null);
              startDeleteTransition(async () => {
                const result = await deleteSessionNoteAction(sessionId);
                if (result.error) {
                  setDeleteError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {deletePending ? "Deleting…" : "Delete note"}
          </Button>
        )}
      </div>
    </form>
  );
}
