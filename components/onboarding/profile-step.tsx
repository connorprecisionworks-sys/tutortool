"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { updatePublicProfileAction, type PublicProfileFormResult } from "@/app/tutor/settings/profile-actions";
import { useHandleCheck } from "@/lib/hooks/use-handle-check";
import type { Tables } from "@/lib/database.types";

const initialState: PublicProfileFormResult = {};

export function ProfileStep({ tutor, nextHref }: { tutor: Tables<"tutors">; nextHref: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: PublicProfileFormResult, formData: FormData) => {
    const result = await updatePublicProfileAction(prev, formData);
    if (!result.error) router.push(nextHref);
    return result;
  }, initialState);

  const [handle, setHandle] = useState(tutor.handle ?? "");
  const handleCheck = useHandleCheck(handle, tutor.handle);
  const handleBlocked = handleCheck.status === "taken" || handleCheck.status === "invalid";

  return (
    <form action={formAction} className="space-y-4">
      {/* This step's one job is picking a handle and publishing — the fuller
          visibility toggles (show bio / show prices / show phone) stay in
          Settings, so preserve whatever they're currently set to instead of
          silently flipping them off just because this trimmed form doesn't
          render those checkboxes. */}
      <input type="hidden" name="is_public" value="on" />
      <input type="hidden" name="subjects" value={tutor.subjects ?? ""} />
      {tutor.show_bio !== false && <input type="hidden" name="show_bio" value="on" />}
      {tutor.show_prices !== false && <input type="hidden" name="show_prices" value="on" />}
      {tutor.show_phone && <input type="hidden" name="show_phone" value="on" />}

      <div>
        <Label htmlFor="handle">Handle</Label>
        <Input
          id="handle"
          name="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="e.g. jane-tutoring"
          autoFocus
          required
        />
        <FieldHint>
          {handleCheck.status === "checking" && "Checking availability…"}
          {handleCheck.status === "available" && "Available."}
          {handleCheck.status === "taken" && handleCheck.message}
          {handleCheck.status === "invalid" && handleCheck.message}
          {handleCheck.status === "error" && handleCheck.message}
          {(handleCheck.status === "idle" || handleCheck.status === "current") &&
            "Your page lives at /t/your-handle — letters, numbers, hyphens, underscores, or periods."}
        </FieldHint>
      </div>

      <div>
        <Label htmlFor="bio">Short bio (optional)</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={tutor.bio ?? ""}
          rows={3}
          placeholder="A sentence or two about how you teach."
        />
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending || handleBlocked}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
