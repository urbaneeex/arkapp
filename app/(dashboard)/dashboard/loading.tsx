/** Skeleton de transición mientras carga RSC al navegar a /dashboard */
export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-8 h-8 w-48 max-w-full animate-pulse rounded bg-zinc-800/80" />
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-zinc-900" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-zinc-900" />
        <div className="h-64 animate-pulse rounded-lg bg-zinc-900" />
      </div>
    </div>
  )
}
