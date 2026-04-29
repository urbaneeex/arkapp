import { WorkBoardAppShell } from './WorkBoardAppShell'
import { WorkBoardKanbanPrecisionSkeleton } from './WorkBoardKanbanPrecisionSkeleton'

/** Primera pintura del tablero (cabecera + columnas) sin datos; misma envoltura vertical que la página real. */
export function WorkBoardKanbanPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkBoardAppShell />
      <WorkBoardKanbanPrecisionSkeleton />
      <span className="sr-only">Cargando tablero…</span>
    </div>
  )
}
