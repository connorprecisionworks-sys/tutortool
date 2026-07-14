"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { createResourceAction, type ResourceFormResult } from "@/app/tutor/resources/actions";
import type { Tables } from "@/lib/database.types";

const initialState: ResourceFormResult = {};

export function ResourceForm({ students }: { students: Tables<"clients">[] }) {
  const router = useRouter();
  const [type, setType] = useState<"link" | "file">("link");
  const [state, formAction, pending] = useActionState(async (prev: ResourceFormResult, formData: FormData) => {
    const result = await createResourceAction(prev, formData);
    if (!result.error) {
      router.push("/tutor/resources");
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="e.g. Week 3 worksheet" required />
      </div>

      <div>
        <Label htmlFor="student_id">Student</Label>
        <Select id="student_id" name="student_id" defaultValue={students[0]?.id}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.student_name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="type">Type</Label>
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as "link" | "file")}>
          <option value="link">Link</option>
          <option value="file">File</option>
        </Select>
      </div>

      {type === "link" ? (
        <div>
          <Label htmlFor="url">URL</Label>
          <Input id="url" name="url" type="url" placeholder="https://…" required />
        </div>
      ) : (
        <div>
          <Label htmlFor="file">File</Label>
          <input
            id="file"
            name="file"
            type="file"
            required
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm"
          />
          <FieldHint>Up to 20 MB.</FieldHint>
        </div>
      )}

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || students.length === 0}>
          {pending ? "Adding…" : "Add resource"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
