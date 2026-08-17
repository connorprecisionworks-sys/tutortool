import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} widths={["w-40", "w-20", "w-24", "w-20", "w-8"]} />
    </div>
  );
}
