import { FilterTabsSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <FilterTabsSkeleton count={4} />
      <TableSkeleton rows={7} widths={["w-32", "w-24", "w-20", "w-20", "w-24", "w-10"]} />
    </div>
  );
}
