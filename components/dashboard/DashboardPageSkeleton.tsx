/**
 * Área de datos del Inicio (KPI + columnas): misma rejilla y alturas que las tarjetas reales para limitar CLS.
 * Sin saludo: va tras PageHeader en la página.
 */
export function DashboardInnerSkeleton() {
  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-32 flex-col rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-6"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 w-24 rounded bg-zinc-800/90" />
              <div className="h-9 w-9 shrink-0 rounded-lg bg-zinc-800/70" />
            </div>
            <div className="mt-auto pt-2">
              <div className="h-8 w-16 rounded-md bg-zinc-800/80" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-6 py-4">
            <div className="h-5 w-40 rounded bg-zinc-800/80" />
          </div>
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-zinc-800/70 p-3">
                <div className="mb-2 h-4 w-[70%] rounded bg-zinc-800/80" />
                <div className="h-3 w-1/2 rounded bg-zinc-800/60" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-6 py-4">
            <div className="h-5 w-44 rounded bg-zinc-800/80" />
          </div>
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-zinc-800/50" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando inicio…</span>
    </>
  )
}

/** Transición de ruta /dashboard: incluye línea tipo título si la página entera está en suspense. */
export function DashboardRouteSkeleton() {
  return (
    <div>
      <div className="mb-8 h-8 w-48 max-w-full animate-pulse rounded bg-zinc-800/80" />
      <DashboardInnerSkeleton />
    </div>
  )
}
