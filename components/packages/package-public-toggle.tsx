"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPackagePublicAction } from "@/app/tutor/packages/actions";

// Callers should pass `key={String(initialIsPublic)}` (or otherwise key on
// it) so React remounts — resetting local state — when the underlying row's
// is_public changes out from under this component (a router.refresh()
// triggered by toggling a different row, or a change from another tab).
export function PackagePublicToggle({ packageId, initialIsPublic }: { packageId: string; initialIsPublic: boolean }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex flex-col items-end gap-1 text-xs text-text-secondary">
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={isPublic}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setIsPublic(next);
            setError(null);
            startTransition(async () => {
              const result = await setPackagePublicAction(packageId, next);
              if (result.error) {
                setIsPublic(!next);
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        />
        On public page
      </span>
      {error && <span className="text-text">{error}</span>}
    </label>
  );
}
