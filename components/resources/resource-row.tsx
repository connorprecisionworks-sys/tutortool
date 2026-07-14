"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpenResourceButton } from "@/components/resources/open-resource-button";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";
import { updateResourceAction, type ResourceFormResult } from "@/app/tutor/resources/actions";

const initialState: ResourceFormResult = {};

export function ResourceRow({
  id,
  title,
  studentName,
  type,
  urlOrPath,
}: {
  id: string;
  title: string;
  studentName: string;
  type: string;
  urlOrPath: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ResourceFormResult, formData: FormData) => {
    const result = await updateResourceAction(prev, formData);
    if (!result.error) {
      setEditing(false);
      router.refresh();
    }
    return result;
  }, initialState);

  if (editing) {
    return (
      <tr className="border-t border-border bg-surface-sunken">
        <td className="px-5 py-3" colSpan={4}>
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <div className="min-w-[180px] flex-1">
              <Input name="title" defaultValue={title} required placeholder="Title" />
            </div>
            {type === "link" && (
              <div className="min-w-[240px] flex-1">
                <Input name="url" type="url" defaultValue={urlOrPath} required placeholder="https://…" />
              </div>
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
          {state.error && <p className="mt-2 text-sm text-text">{state.error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-5 py-3 font-medium">{title}</td>
      <td className="px-5 py-3 text-text-secondary">{studentName}</td>
      <td className="px-5 py-3 text-text-secondary capitalize">{type}</td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <OpenResourceButton resourceId={id} label="Open" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-text-tertiary hover:text-text"
          >
            Edit
          </button>
          <DeleteResourceButton resourceId={id} />
        </div>
      </td>
    </tr>
  );
}
