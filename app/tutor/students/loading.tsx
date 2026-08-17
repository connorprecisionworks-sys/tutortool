import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} widths={["w-32", "w-40", "w-20", "w-24", "w-16"]} />
    </div>
  );
}
