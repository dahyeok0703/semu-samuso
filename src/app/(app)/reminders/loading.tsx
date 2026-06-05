import { Skeleton } from "@/components/ui/skeleton";

export default function RemindersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 w-full rounded-xl lg:col-span-1" />
        <Skeleton className="h-56 w-full rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
