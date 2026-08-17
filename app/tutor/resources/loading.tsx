import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} widths={["w-40", "w-24", "w-24", "w-16", "w-8"]} />
    </div>
  );
}
