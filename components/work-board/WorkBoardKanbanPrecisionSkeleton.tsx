/**
 * Skeleton alineado con KanbanColumn (280px ancho, cabecera px-3 py-1.5, cuerpo gap-2 p-2)
 * y tarjetas compactas (~altura similar a WorkBoardCard compact).
 */
export function WorkBoardKanbanPrecisionSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex min-h-[min(420px,56vh)] items-start gap-3 pb-4">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="flex w-[280px] min-w-[280px] max-w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50"
        >
          <div className="shrink-0 rounded-t-xl border-b border-zinc-800 px-3 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-700/90 ring-1 ring-zinc-700/80" />
                <div className="h-4 flex-1 rounded bg-zinc-800/90" />
                <div className="h-3 w-6 shrink-0 rounded bg-zinc-800/70" />
              </div>
              <div className="h-8 w-8 shrink-0 rounded-md bg-zinc-800/60" />
            </div>
          </div>
          <div className="flex min-h-[280px] flex-col gap-2 p-2">
            <div className="min-h-[112px] rounded-lg border border-zinc-800/90 bg-zinc-900/55 p-3">
              <div className="mb-2 h-4 w-[85%] rounded bg-zinc-800/80" />
              <div className="mb-3 h-3 w-1/2 rounded bg-zinc-800/60" />
              <div className="flex gap-2">
                <div className="h-6 w-14 rounded-full bg-zinc-800/70" />
                <div className="h-6 flex-1 rounded-md bg-zinc-800/50" />
              </div>
            </div>
            <div className="min-h-[96px] rounded-lg border border-zinc-800/90 bg-zinc-900/45 p-3">
              <div className="mb-2 h-4 w-[70%] rounded bg-zinc-800/75" />
              <div className="h-3 w-2/3 rounded bg-zinc-800/55" />
            </div>
            <div className="h-24 rounded-lg border border-dashed border-zinc-800/70 bg-zinc-900/35" />
          </div>
        </div>
      ))}
    </div>
  )
}
