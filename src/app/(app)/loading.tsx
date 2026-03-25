import { Skeleton, SkeletonCard } from "@/components/ui/states";

export default function AppLoading() {
  return (
    <div className="space-y-5 pb-20">
      <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-64" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>

      <div className="rounded-[28px] border border-border/80 bg-white p-6 shadow-[0_22px_48px_rgba(15,23,42,0.08)]">
        <Skeleton className="h-3 w-32 bg-white/25" />
        <Skeleton className="mt-3 h-12 w-72 bg-slate-100" />
        <Skeleton className="mt-2 h-3 w-56 bg-slate-100" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={`kpi-${index}`} lines={3} />
        ))}
      </div>

      <SkeletonCard lines={5} />
    </div>
  );
}
