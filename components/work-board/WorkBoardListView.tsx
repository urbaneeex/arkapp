'use client'

import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { WorkItemCard } from '@/lib/work-items/types'
import type { PipelineStageRow } from '@/lib/work-items/types'
import { canMoveWorkItemByStageSlug } from '@/lib/work-items/canMoveWorkItem'

export function WorkBoardListView({
  stages,
  items,
  canEdit,
}: {
  stages: PipelineStageRow[]
  items: WorkItemCard[]
  canEdit: boolean
}) {
  const router = useRouter()

  const onStageSelect = async (itemId: string, pipelineStageId: string) => {
    const res = await fetch(`/api/work-items/${itemId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage_id: pipelineStageId }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">Título</th>
            <th className="px-3 py-2 font-medium">Cliente</th>
            <th className="px-3 py-2 font-medium">Responsable</th>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Etapa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {items.map((row) => {
            const start = parseISO(row.start_time)
            const end = parseISO(row.end_time)
            const when = `${format(start, 'd MMM yyyy HH:mm', { locale: es })} – ${format(end, 'HH:mm')}`
            const movable = canMoveWorkItemByStageSlug(row.stage_slug)
            return (
              <tr key={row.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 font-medium text-zinc-100">
                  <a href={`/dashboard/appointments/${row.id}/edit`} className="hover:underline text-left">
                    {row.displayTitle}
                  </a>
                </td>
                <td className="px-3 py-2 text-zinc-300">{row.client_name ?? '—'}</td>
                <td className="px-3 py-2 text-zinc-300">{row.staff_name ?? '—'}</td>
                <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{when}</td>
                <td className="px-3 py-2">
                  {canEdit && movable ? (
                    <select
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 text-sm cursor-pointer max-w-[200px]"
                      value={row.pipeline_stage_id}
                      onChange={(e) => onStageSelect(row.id, e.target.value)}
                      aria-label={`Etapa para ${row.displayTitle}`}
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-zinc-400">{row.stage_label}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {items.length === 0 && (
        <p className="px-4 py-8 text-center text-zinc-500 text-sm">No hay elementos en el tablero.</p>
      )}
    </div>
  )
}
