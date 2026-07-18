"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveServiceAction } from "@/app/tutor/settings/services/actions";

export function ServiceReorderButtons({
  serviceId,
  isFirst,
  isLast,
}: {
  serviceId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveServiceAction(serviceId, direction);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          disabled={pending || isFirst}
          onClick={() => move("up")}
          aria-label="Move up"
          className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-hover hover:text-text disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          onClick={() => move("down")}
          aria-label="Move down"
          className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-hover hover:text-text disabled:opacity-30"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </span>
      {error && <span className="max-w-[10rem] text-[10px] leading-tight text-text">{error}</span>}
    </span>
  );
}
