import { FilterTabsSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

// Column widths mirror the real header in page.tsx —
// Student / Period / Total / Status / Due / (actions).
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <FilterTabsSkeleton count={5} />
      <TableSkeleton rows={6} widths={["w-32", "w-28", "w-16", "w-20", "w-20", "w-8"]} />
    </div>
  );
}
