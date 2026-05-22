/**
 * Marco estático del tablero (sin datos Supabase): primera pintura inmediata junto al Suspense.
 */
export function WorkBoardAppShell() {
  return (
    <div className="mb-3 flex shrink-0 flex-col gap-3 lg:mb-6" aria-hidden>
      <div className="h-8 w-24 rounded-md bg-zinc-800/60" />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-[200px] rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
          <span className="h-full w-1/2 rounded-md bg-zinc-800/90" />
          <span className="h-full w-1/2 rounded-md opacity-40" />
        </div>
        <div className="h-9 min-w-[120px] flex-1 max-w-md rounded-lg border border-zinc-800 bg-zinc-900/50" />
        <div className="h-9 w-28 rounded-lg border border-zinc-800 bg-zinc-900/50" />
      </div>
    </div>
  )
}
