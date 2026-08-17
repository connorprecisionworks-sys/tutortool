import { CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton withAction={false} />
      <CardSkeleton lines={7} className="mb-4" />
      <CardSkeleton lines={3} />
    </div>
  );
}
