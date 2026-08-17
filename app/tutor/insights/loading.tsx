import { CardSkeleton, PageHeaderSkeleton, StatRowSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton withAction={false} />
      <StatRowSkeleton count={3} />
      <CardSkeleton lines={6} className="mb-4" />
      <CardSkeleton lines={4} />
    </div>
  );
}
