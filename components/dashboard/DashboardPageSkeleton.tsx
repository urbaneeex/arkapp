function SurfaceCardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 md:p-5 ${tall ? 'min-h-[280px]' : 'min-h-[120px]'}`}
    >
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-800/80" />
      <div className="h-8 w-12 animate-pulse rounded bg-zinc-800/70" />
      {tall ? <div className="my-3 border-t border-zinc-800/60" /> : null}
      {tall ? <div className="mt-2 h-20 w-full animate-pulse rounded bg-zinc-800/50" /> : null}
    </div>
  )
}

export function DashboardPendingActionsSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
      <div className="mb-3 h-4 w-36 animate-pulse rounded bg-zinc-800/80" />
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/50" />
        ))}
      </div>
    </div>
  )
}

export function DashboardHeroMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <SurfaceCardSkeleton />
      <SurfaceCardSkeleton />
    </div>
  )
}

export function DashboardTasksListSkeleton() {
  return (
    <div className="space-y-3">
      <SurfaceCardSkeleton tall />
      <DashboardSkelRow index={0} />
      <DashboardSkelRow index={1} />
    </div>
  )
}

export function OwnerTasksNumberSkeleton() {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center text-center md:max-w-[40%] md:pr-4 md:border-r md:border-zinc-800/80">
      <div className="h-10 w-14 animate-pulse rounded bg-zinc-800/70" />
      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-zinc-800/50" />
    </div>
  )
}

export function OwnerTasksListInlineSkeleton() {
  return (
    <div className="min-w-0 flex-1 border-t border-zinc-800/80 pt-4 md:border-t-0 md:pl-4">
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-800/50" />
        ))}
      </div>
    </div>
  )
}

export function OwnerMiniMetricSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 py-1">
      <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/60" />
      <div className="h-8 w-10 animate-pulse rounded bg-zinc-800/70" />
    </div>
  )
}

export function OwnerWeekMetricsSkeleton() {
  return (
    <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <OwnerMiniMetricSkeleton key={i} />
      ))}
    </div>
  )
}

export function OwnerWeekChartSkeleton() {
  return (
    <div className="flex min-w-0 flex-col border-t border-zinc-800/80 pt-4 md:border-t-0 md:pt-0 md:pl-5">
      <div className="mb-2 h-3 w-28 animate-pulse rounded bg-zinc-800/60" />
      <div className="h-24 w-full animate-pulse rounded bg-zinc-800/50" />
    </div>
  )
}

export function OwnerSecondaryRowSkeleton() {
  return <DashboardSkelRow index={1} />
}

export function StaffWeekMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <OwnerMiniMetricSkeleton key={i} />
      ))}
    </div>
  )
}

export function StaffSecondaryRowsSkeleton() {
  return (
    <>
      <DashboardSkelRow index={1} />
      <div className="mt-3 md:mt-4">
        <SurfaceCardSkeleton />
      </div>
    </>
  )
}

/** Skeleton métricas: 2 filas × 2 cards (sin header ni pending). */
export function DashboardMetricsSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, row) => (
        <DashboardSkelRow key={row} index={row} />
      ))}
      <span className="sr-only">Cargando métricas…</span>
    </>
  )
}

export function DashboardNoBusinessNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-950/50 p-6 text-amber-200">
      <p className="font-medium">No tienes un negocio configurado</p>
      <p className="mt-1 text-sm">
        Contacta al administrador para asociar tu cuenta a un negocio.
      </p>
    </div>
  )
}

/** Placeholders: header + 2 filas × 2 cards (owner unificado). */
export function DashboardInnerSkeleton() {
  return (
    <>
      <div className="mb-5 space-y-2">
        <div className="h-8 w-48 max-w-full animate-pulse rounded bg-zinc-800/80" />
        <div className="h-4 w-56 animate-pulse rounded bg-zinc-800/60" />
      </div>
      {Array.from({ length: 2 }).map((_, row) => (
        <DashboardSkelRow key={row} index={row} />
      ))}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-zinc-800/80" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/50" />
          ))}
        </div>
      </div>
      <span className="sr-only">Cargando inicio…</span>
    </>
  )
}

function DashboardSkelRow({ index }: { index: number }) {
  return (
    <div
      className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${index > 0 ? 'mt-3 md:mt-4' : ''}`}
    >
      <SurfaceCardSkeleton tall={index === 0} />
      <SurfaceCardSkeleton tall={index === 0} />
    </div>
  )
}

export function DashboardRouteSkeleton() {
  return (
    <div>
      <DashboardInnerSkeleton />
    </div>
  )
}
