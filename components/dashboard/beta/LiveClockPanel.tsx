'use client'

/**
 * Beta (no activo para usuarios): listado en tiempo real «quién está fichado» en el dashboard Inicio.
 * Solo se monta si `NEXT_PUBLIC_DASHBOARD_LIVE_CLOCK_BETA=1` — ver `app/(dashboard)/dashboard/page.tsx`.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { differenceInSeconds, format, parseISO } from 'date-fns'
import { Users, Coffee, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type LiveEntry = {
  id: string
  clock_in: string
  source: string | null
  break_start: string | null
  break_end: string | null
  staff: {
    id: string
    name: string
    avatar_url: string | null
    color: string | null
  } | null
}

function Elapsed({
  clockIn,
  breakStart,
  breakEnd,
}: {
  clockIn: string
  breakStart: string | null
  breakEnd: string | null
}) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    const update = () => {
      const total = differenceInSeconds(new Date(), parseISO(clockIn))
      if (breakStart && !breakEnd) {
        const paused = differenceInSeconds(new Date(), parseISO(breakStart))
        setSecs(Math.max(0, total - paused))
      } else if (breakStart && breakEnd) {
        const breakDur = differenceInSeconds(parseISO(breakEnd), parseISO(breakStart))
        setSecs(Math.max(0, total - breakDur))
      } else {
        setSecs(total)
      }
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [clockIn, breakStart, breakEnd])

  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const label =
    h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  return <span className="font-mono text-xs tabular-nums text-zinc-300">{label}</span>
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function Avatar({ name, color }: { name: string; color: string | null }) {
  const bg = color ?? '#3B82F6'
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-zinc-900"
      style={{ backgroundColor: bg }}
    >
      {getInitials(name)}
    </div>
  )
}

export function LiveClockPanel({ businessId }: { businessId: string }) {
  const [entries, setEntries] = useState<LiveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const fetchEntries = useCallback(async () => {
    try {
      const res = await globalThis.fetch(`/api/clock/live-status?business_id=${businessId}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      setEntries(data.entries ?? [])
      setLastUpdated(new Date())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void fetchEntries()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchEntries()
    }
    document.addEventListener('visibilitychange', onVisible)
    const onClock = () => void fetchEntries()
    window.addEventListener('clock-status-changed', onClock)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('clock-status-changed', onClock)
    }
  }, [fetchEntries])

  return (
    <div className="rounded-2xl border border-dashed border-amber-800/40 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Quién está fichado ahora</h3>
          <span className="rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
            Beta
          </span>
          {entries.length > 0 && (
            <span className="rounded-full border border-green-700/50 bg-green-900/50 px-2 py-0.5 text-xs text-green-300">
              {entries.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={fetchEntries}
          className="p-1 text-zinc-600 transition-colors hover:text-zinc-300"
          title="Actualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-zinc-600">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-600">Nadie fichado en este momento</div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isOnBreak = !!(entry.break_start && !entry.break_end)
            const name = entry.staff?.name ?? 'Empleado'
            return (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  isOnBreak
                    ? 'border-amber-800/30 bg-amber-950/20'
                    : 'border-zinc-700/50 bg-zinc-800/50'
                )}
              >
                <div className="relative">
                  <Avatar name={name} color={entry.staff?.color ?? null} />
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-900',
                      isOnBreak ? 'bg-amber-400' : 'bg-green-400'
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {isOnBreak ? (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Coffee className="h-3 w-3" />
                        En pausa
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        Entrada {format(parseISO(entry.clock_in), 'HH:mm')}
                      </span>
                    )}
                    {entry.source && entry.source !== 'manual' && (
                      <span className="text-xs capitalize text-zinc-600">· {entry.source}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Elapsed
                    clockIn={entry.clock_in}
                    breakStart={entry.break_start}
                    breakEnd={entry.break_end}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lastUpdated && (
        <p className="mt-3 text-right text-[10px] text-zinc-700">
          Actualizado {format(lastUpdated, 'HH:mm:ss')} · al volver a la pestaña o tras fichar
        </p>
      )}
    </div>
  )
}
