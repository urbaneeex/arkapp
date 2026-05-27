'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { workBoardNewTaskPageHeaderClass } from '@/lib/work-board/workBoardHeaderClasses'

export function WorkBoardNewTaskLoadingPanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Nueva tarea" className={workBoardNewTaskPageHeaderClass} />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-8">
        <p className="text-sm text-zinc-500">Cargando…</p>
      </div>
    </div>
  )
}
