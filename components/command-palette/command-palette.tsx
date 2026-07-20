"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export interface CommandPaletteNavItem {
  href: string;
  label: string;
}

export interface CommandPaletteStudent {
  id: string;
  student_name: string;
}

type Group = "Actions" | "Pages" | "Students";

interface Entry {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  group: Group;
}

// E5 (build-queue.md): the top quick-actions, each with a direct route —
// these are what "shortcuts for the top actions" resolves to (see that
// item's SAFETY EXCEPTION note: no bare-letter global shortcuts, just a
// palette reachable in ~3 keystrokes).
const QUICK_ACTIONS: { label: string; href: string }[] = [
  { label: "Log session", href: "/tutor/sessions/new" },
  { label: "New invoice", href: "/tutor/invoices/new" },
  { label: "Add student", href: "/tutor/students/new" },
  { label: "Set availability", href: "/tutor/schedule" },
  { label: "New service", href: "/tutor/settings/services/new" },
  { label: "New package", href: "/tutor/packages/new" },
  { label: "New booking link", href: "/tutor/booking-links/new" },
  { label: "Add expense", href: "/tutor/expenses/new" },
];

const MAX_FILTERED_RESULTS = 8;
const MAX_DEFAULT_RESULTS = 20;

/**
 * Case-insensitive match with three tiers, ranked best-first:
 *   3 = target starts with the query
 *   2 = query appears anywhere as a substring
 *   1 = every query character appears in order somewhere in target
 *       (a lightweight subsequence fuzzy match — e.g. "ssn" -> "Sessions")
 *   0 = no match at all
 * Deliberately simple per build-queue.md E5: no fuzzy-search dependency,
 * just enough ranking that exact/prefix matches win over loose ones.
 */
function matchScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return 0;
    ti = idx + 1;
  }
  return 1;
}

export function CommandPalette({
  navItems,
  students,
}: {
  navItems: CommandPaletteNavItem[];
  students: CommandPaletteStudent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries: Entry[] = useMemo(() => {
    const actionEntries: Entry[] = QUICK_ACTIONS.map((a) => ({
      id: `action-${a.href}`,
      label: a.label,
      href: a.href,
      group: "Actions",
    }));
    const navEntries: Entry[] = navItems.map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      href: n.href,
      group: "Pages",
    }));
    const studentEntries: Entry[] = students.map((s) => ({
      id: `student-${s.id}`,
      label: s.student_name,
      sublabel: "Student",
      href: `/tutor/students/${s.id}`,
      group: "Students",
    }));
    return [...actionEntries, ...navEntries, ...studentEntries];
  }, [navItems, students]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Nothing typed yet: browse quick actions + pages, not the full
      // student roster (which could be long and isn't "top of mind" until
      // the tutor starts typing a name).
      return entries.filter((e) => e.group !== "Students").slice(0, MAX_DEFAULT_RESULTS);
    }
    return entries
      .map((e) => ({ e, score: matchScore(trimmed, e.label) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.e)
      .slice(0, MAX_FILTERED_RESULTS);
  }, [entries, query]);

  // Refs mirror the latest results/activeIndex so the single window
  // keydown listener below never needs to be torn down and re-added on
  // every keystroke (it only depends on `open`), while still always
  // acting on current data. Assigned in an effect (not during render) —
  // mutating a ref while rendering isn't safe/supported.
  const resultsRef = useRef(results);
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    resultsRef.current = results;
    activeIndexRef.current = activeIndex;
  });

  // Reset the highlighted row whenever the query changes or the palette
  // re-opens, using React's "adjust state during render" pattern (comparing
  // against the previous value directly, rather than an effect that calls
  // setState) so this doesn't cause an extra post-commit render pass.
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevOpen, setPrevOpen] = useState(open);
  if (query !== prevQuery || open !== prevOpen) {
    setPrevQuery(query);
    setPrevOpen(open);
    setActiveIndex(0);
  }

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const activate = useCallback(
    (entry: Entry) => {
      close();
      router.push(entry.href);
    },
    [close, router]
  );

  // Global Cmd/Ctrl+K listener — must fire even while the user is typing
  // inside an actual input/textarea/select elsewhere in the app (that's
  // the point of the shortcut), so this is the one case intentionally NOT
  // guarded behind a "not currently typing" check. No other bare-key
  // shortcut is registered globally (see build-queue.md E5's "what NOT to
  // do" — this is the only one).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      const current = resultsRef.current;
      if (e.key === "ArrowDown" || (isMod && e.key === "n")) {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, current.length - 1));
        return;
      }
      if (e.key === "ArrowUp" || (isMod && e.key === "p")) {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const entry = current[activeIndexRef.current];
        if (entry) activate(entry);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, activate]);

  // Keep the highlighted row scrolled into view as arrow keys move it.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  let renderIndex = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 h-9 text-xs text-text-secondary hover:bg-hover hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border-strong px-1 py-0.5 text-[10px] leading-none text-text-tertiary sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 px-4 pt-[10vh] sm:pt-[14vh]"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface motion-safe:animate-[fade-rise-in_150ms_ease-out]"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-text-tertiary"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a page, action, or student…"
                aria-label="Search actions, pages, and students"
                className="h-12 w-full bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
            <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-text-tertiary">No matches</p>
              )}
              {(["Actions", "Pages", "Students"] as Group[]).map((group) => {
                const groupResults = results.filter((e) => e.group === group);
                if (groupResults.length === 0) return null;
                return (
                  <div key={group} className="mb-1 last:mb-0">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                      {group}
                    </p>
                    {groupResults.map((entry) => {
                      renderIndex += 1;
                      const index = renderIndex;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          data-index={index}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => activate(entry)}
                          className={clsx(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                            active ? "bg-hover text-text" : "text-text-secondary"
                          )}
                        >
                          <span>{entry.label}</span>
                          {entry.sublabel && (
                            <span className="text-xs text-text-tertiary">{entry.sublabel}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
