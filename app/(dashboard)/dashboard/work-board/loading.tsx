/** Skeleton mientras carga el tablero (misma estructura básica que la vista compacta) */
export default function WorkBoardLoading() {
  return (
    <div className="flex min-h-[320px] flex-1 flex-col">
      <div className="mb-6 flex flex-col gap-3">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-800/80" />
        <div className="h-10 w-full max-w-2xl animate-pulse rounded bg-zinc-800/50" />
      </div>
      <div className="min-h-[280px] flex-1 animate-pulse rounded-lg bg-zinc-900/60" />
    </div>
  )
}
