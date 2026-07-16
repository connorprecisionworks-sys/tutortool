"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { redeemTutorCodeAction, type RedeemTutorCodeResult } from "@/app/parent/actions";

const initialState: RedeemTutorCodeResult = {};
const ADD_NEW = "__add_new__";

export function TutorCodeSetupForm({
  tutorCode,
  tutorName,
  unclaimedStudents,
}: {
  tutorCode: string;
  tutorName: string;
  unclaimedStudents: { id: string; student_name: string }[];
}) {
  const router = useRouter();
  const [selection, setSelection] = useState(unclaimedStudents.length > 0 ? unclaimedStudents[0].id : ADD_NEW);
  const [state, formAction, pending] = useActionState(async (prev: RedeemTutorCodeResult, formData: FormData) => {
    const result = await redeemTutorCodeAction(prev, formData);
    if (!result.error) {
      router.push("/parent");
      router.refresh();
    }
    return result;
  }, initialState);

  const isAddingNew = selection === ADD_NEW;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tutor_code" value={tutorCode} />
      <p className="text-sm text-text-secondary">Joining {tutorName}&apos;s roster.</p>

      {unclaimedStudents.length > 0 && (
        <div>
          <Label htmlFor="selection">Your child</Label>
          <Select id="selection" value={selection} onChange={(e) => setSelection(e.target.value)}>
            {unclaimedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_name}
              </option>
            ))}
            <option value={ADD_NEW}>Someone else — add their name</option>
          </Select>
          <input type="hidden" name="existing_student_id" value={isAddingNew ? "" : selection} />
        </div>
      )}

      {isAddingNew && (
        <div>
          <Label htmlFor="child_name">Your child&apos;s name</Label>
          <Input id="child_name" name="child_name" required />
          <FieldHint>Your tutor will confirm this on their end.</FieldHint>
        </div>
      )}

      {state.error && <p className="text-sm text-text">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Join"}
      </Button>
    </form>
  );
}
