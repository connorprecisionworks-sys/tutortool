"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { updateStudentNameAction } from "@/app/tutor/students/actions";
import { useInlineSave } from "@/lib/hooks/use-inline-save";

/**
 * E4 (build-queue.md) — the Student name column has to stay a working link
 * to /tutor/students/[id] (invite codes, packages, session history all live
 * there) AND be inline-renamable without navigating away. Overloading one
 * click target for both "navigate" and "edit" is ambiguous, so this uses a
 * separate small edit-pencil button next to the name — clicking the name
 * still navigates, clicking the pencil switches to inline rename.
 */
export function InlineStudentNameCell({
  studentId,
  studentName,
  isPhilanthropic,
}: {
  studentId: string;
  studentName: string;
  isPhilanthropic: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(studentName);
  const [displayName, setDisplayName] = useState(studentName);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const { save, pending, error, saved, setError } = useInlineSave(updateStudentNameAction);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    // Defensive reset — see the matching comment in inline-price-cell.tsx:
    // Escape-cancel can leave skipBlurRef stuck true if no real blur event
    // ever reaches handleBlur, which would otherwise swallow the next
    // legitimate commit on this cell.
    skipBlurRef.current = false;
    setValue(displayName);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    skipBlurRef.current = true;
    setEditing(false);
    setError(null);
  }

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Student name is required.");
      return;
    }
    if (trimmed === displayName) {
      setEditing(false);
      return;
    }
    const previous = displayName;
    setDisplayName(trimmed);
    setEditing(false);
    save([studentId, trimmed], {
      successMessage: "Name updated",
      onError: () => setDisplayName(previous),
    });
  }

  function handleBlur() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    commit();
  }

  if (editing) {
    return (
      <td className="px-5 py-3">
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={pending}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className="h-8 w-full max-w-[12rem] rounded-lg border border-border bg-surface px-2 text-sm font-medium text-text focus:outline-none focus:border-border-strong focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50"
          />
          {error && <p className="text-xs text-text">{error}</p>}
        </div>
      </td>
    );
  }

  return (
    <td className="px-5 py-3">
      <span className="inline-flex items-center gap-1.5">
        <Link href={`/tutor/students/${studentId}`} className="font-medium hover:underline">
          {displayName}
        </Link>
        <button
          type="button"
          onClick={startEdit}
          title="Rename student"
          aria-label="Rename student"
          className="rounded p-0.5 text-text-tertiary hover:bg-hover hover:text-text focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
          </svg>
        </button>
        {saved && (
          <span className="text-xs text-text-tertiary motion-safe:animate-[fade-rise-in_150ms_ease-out]" aria-hidden>
            ✓
          </span>
        )}
        {isPhilanthropic && <span className="ml-1 text-xs text-text-tertiary">community impact</span>}
      </span>
    </td>
  );
}
