export default function SalesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-muted" />
          <div className="h-4 w-52 rounded bg-muted" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-muted" />
      </div>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3 grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-4 rounded bg-muted" />)}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b last:border-0 px-4 py-4 grid grid-cols-4 gap-4">
            <div className="col-span-2 space-y-1.5">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
