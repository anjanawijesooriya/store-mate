export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-muted" />
          <div className="h-4 w-52 rounded bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-32 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart skeleton */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-3 shadow-sm">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-48 rounded-lg bg-muted/60" />
        </div>

        {/* Top products skeleton */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="h-5 w-48 rounded bg-muted" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-5 rounded bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
              <div className="h-5 w-16 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
