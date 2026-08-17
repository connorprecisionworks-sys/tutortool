import { StatRowSkeleton, CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton withAction={false} />
      <StatRowSkeleton count={3} />
      <CardSkeleton lines={4} className="mb-4" />
      <CardSkeleton lines={3} />
    </div>
  );
}
