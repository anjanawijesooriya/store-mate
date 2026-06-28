export default function InventoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-lg bg-muted" />
          <div className="h-4 w-44 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>

      {/* Search bar */}
      <div className="h-10 w-full rounded-lg bg-muted" />

      {/* Product table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3 grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="border-b last:border-0 px-4 py-3.5 grid grid-cols-5 gap-4"
          >
            <div className="col-span-2 space-y-1.5">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded bg-muted" />
              <div className="h-7 w-7 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
