"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { updatePublicProfileAction, type PublicProfileFormResult } from "@/app/tutor/settings/profile-actions";
import { publicAppUrl } from "@/lib/app-url";
import type { Tables } from "@/lib/database.types";

const initialState: PublicProfileFormResult = {};

export function PublicProfileForm({ tutor }: { tutor: Tables<"tutors"> }) {
  const [state, formAction, pending] = useActionState(updatePublicProfileAction, initialState);
  const publicUrl = tutor.handle ? `${publicAppUrl()}/t/${tutor.handle}` : null;

  return (
    <form action={formAction} className="space-y-4">
      {tutor.is_public && publicUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
          <code className="flex-1 truncate text-sm">{publicUrl}</code>
          <CopyButton value={publicUrl} size="sm" />
        </div>
      )}

      <div>
        <Label htmlFor="handle">Handle</Label>
        <Input id="handle" name="handle" defaultValue={tutor.handle ?? ""} placeholder="e.g. jane-tutoring" />
        <FieldHint>Lowercase letters, numbers, and hyphens only. Your page lives at /t/your-handle.</FieldHint>
      </div>

      <div>
        <Label htmlFor="bio">Short bio</Label>
        <Textarea id="bio" name="bio" defaultValue={tutor.bio ?? ""} rows={3} />
      </div>

      <div>
        <Label htmlFor="subjects">Subjects</Label>
        <Input id="subjects" name="subjects" defaultValue={tutor.subjects ?? ""} placeholder="e.g. Algebra, SAT Prep, Physics" />
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_public" defaultChecked={tutor.is_public} className="h-4 w-4 rounded border-border" />
          Publish my page
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="show_bio" defaultChecked={tutor.show_bio} className="h-4 w-4 rounded border-border" />
          Show my bio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="show_prices" defaultChecked={tutor.show_prices} className="h-4 w-4 rounded border-border" />
          Show service prices
        </label>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}
      {state.success && <p className="text-sm text-text-secondary">Saved.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
