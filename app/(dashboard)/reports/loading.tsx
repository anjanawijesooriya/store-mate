export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 rounded-lg bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3 shadow-sm">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-56 rounded-lg bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Sales table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="h-5 w-32 rounded bg-muted" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border-b last:border-0 px-4 py-3.5 flex items-center gap-4"
          >
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
