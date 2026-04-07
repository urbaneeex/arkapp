'use client'

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

function Elapsed({ clockIn, breakStart, breakEnd }: { clockIn: string; breakStart: string | null; breakEnd: string | null }) {
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
  const label = h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

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
      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-zinc-900"
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    try {
      const res = await globalThis.fetch(`/api/clock/live-status?business_id=${businessId}`, { cache: 'no-store' })
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
    fetch()
    pollRef.current = setInterval(fetch, 60_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetch])

  // Re-fetch immediately when any user clocks in or out
  useEffect(() => {
    const handler = () => void fetch()
    window.addEventListener('clock-status-changed', handler)
    return () => window.removeEventListener('clock-status-changed', handler)
  }, [fetch])

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Quién está fichado ahora</h3>
          {entries.length > 0 && (
            <span className="bg-green-900/50 text-green-300 text-xs px-2 py-0.5 rounded-full border border-green-700/50">
              {entries.length}
            </span>
          )}
        </div>
        <button
          onClick={fetch}
          className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Cargando…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-600">
          Nadie fichado en este momento
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isOnBreak = !!(entry.break_start && !entry.break_end)
            const name = entry.staff?.name ?? 'Empleado'
            return (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 border',
                  isOnBreak
                    ? 'bg-amber-950/20 border-amber-800/30'
                    : 'bg-zinc-800/50 border-zinc-700/50'
                )}
              >
                <div className="relative">
                  <Avatar name={name} color={entry.staff?.color ?? null} />
                  <span className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-900',
                    isOnBreak ? 'bg-amber-400' : 'bg-green-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
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
                      <span className="text-xs text-zinc-600 capitalize">· {entry.source}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
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
        <p className="text-[10px] text-zinc-700 mt-3 text-right">
          Actualizado {format(lastUpdated, 'HH:mm:ss')} · auto cada 60s
        </p>
      )}
    </div>
  )
}
