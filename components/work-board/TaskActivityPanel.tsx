'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { workBoardKeys } from '@/lib/work-board/workBoardQueryKeys'
import type { AppointmentActivityItem } from '@/lib/work-board/appointmentActivityTypes'
import { TaskActivityItem } from './TaskActivityItem'
import { TaskCommentEditor } from './TaskCommentEditor'

const PREVIEW_BATCH = 50

async function fetchActivity(appointmentId: string): Promise<AppointmentActivityItem[]> {
  const res = await fetch(`/api/work-items/${appointmentId}/activity`)
  if (!res.ok) throw new Error('activity')
  const json = (await res.json()) as { items?: AppointmentActivityItem[] }
  return json.items ?? []
}

export function TaskActivityPanel({
  appointmentId,
  enabled = true,
  showHeader = true,
}: {
  appointmentId: string
  enabled?: boolean
  showHeader?: boolean
}) {
  const queryClient = useQueryClient()
  const listRef = useRef<HTMLUListElement>(null)
  const [showAll, setShowAll] = useState(false)

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: workBoardKeys.activity(appointmentId),
    queryFn: () => fetchActivity(appointmentId),
    enabled: enabled && Boolean(appointmentId),
    staleTime: 15_000,
  })

  const visibleItems = useMemo(() => {
    if (showAll || items.length <= PREVIEW_BATCH) return items
    return items.slice(-PREVIEW_BATCH)
  }, [items, showAll])

  const hiddenCount = items.length - visibleItems.length

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!isLoading && items.length > 0) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [isLoading, items.length, scrollToBottom])

  const postMutation = useMutation({
    mutationFn: async (content: object) => {
      const res = await fetch(`/api/work-items/${appointmentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'No se pudo publicar')
      }
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workBoardKeys.activity(appointmentId) })
      setShowAll(true)
      requestAnimationFrame(scrollToBottom)
    },
    onError: (e: Error) => {
      toast.error(e.message || 'No se pudo publicar el comentario')
    },
  })

  return (
    <aside className="flex h-full min-h-0 flex-1 flex-col">
      {showHeader ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-3 md:px-6">
          <Activity className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <h3 className="font-display text-sm font-semibold text-zinc-100">Actividad</h3>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : isError ? (
          <p className="flex flex-1 items-center justify-center p-4 text-center text-[13px] text-zinc-500">
            No se pudo cargar la actividad.{' '}
            <button
              type="button"
              className="text-brand hover:underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </p>
        ) : items.length === 0 ? (
          <p className="flex flex-1 items-center justify-center p-4 text-center text-[13px] text-zinc-500">
            Sin actividad todavía. Deja el primer comentario.
          </p>
        ) : (
          <ul
            ref={listRef}
            className="absolute inset-0 overflow-y-auto px-3 py-3 space-y-2"
          >
            {hiddenCount > 0 ? (
              <li className="pb-1 text-center">
                <button
                  type="button"
                  className="text-[11px] font-medium text-brand hover:underline"
                  onClick={() => setShowAll(true)}
                >
                  Ver {hiddenCount} anteriores
                </button>
              </li>
            ) : null}
            {visibleItems.map((item) => (
              <TaskActivityItem key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-800 p-3">
        <TaskCommentEditor
          onSubmit={(content) => postMutation.mutate(content)}
          submitting={postMutation.isPending}
          disabled={!enabled}
        />
      </div>
    </aside>
  )
}
