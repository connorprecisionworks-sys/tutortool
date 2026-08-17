import { PageHeaderSkeleton, StatRowSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <StatRowSkeleton count={3} />
      <TableSkeleton rows={6} widths={["w-24", "w-32", "w-24", "w-16", "w-8"]} />
    </div>
  );
}
