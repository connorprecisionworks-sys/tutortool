import Link from "next/link";

/**
 * Shared status-filter tab bar (tutor + parent invoice lists). "all" links
 * to the bare basePath with no query string; every other tab appends
 * ?status=<tab>. Caller owns deriving `current` from searchParams (each
 * page validates against its own tab set before trusting the query value).
 */
export function StatusFilterTabs({
  tabs,
  current,
  basePath,
}: {
  tabs: readonly string[];
  current: string;
  basePath: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t}
          href={t === "all" ? basePath : `${basePath}?status=${t}`}
          className={current === t ? "font-medium text-text" : "text-text-secondary hover:text-text"}
        >
          {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
        </Link>
      ))}
    </div>
  );
}
