'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { differenceInSeconds, format, parseISO } from 'date-fns'
import { Clock, MapPin, QrCode, Loader2, CheckCircle, ScanLine, Coffee, Play } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ClockInMethod } from '@/lib/clock-in-method'

type ClockEntry = {
  id: string
  clock_in: string
  source: string
  break_start?: string | null
  break_end?: string | null
}

type ClockStatus = {
  clocked_in: boolean
  entry: ClockEntry | null
  method: ClockInMethod
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}m`
}

export function ClockStatusButton() {
  const [status, setStatus] = useState<ClockStatus | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [open, setOpen] = useState(false)
  const [actionState, setActionState] = useState<
    'idle' | 'loading' | 'gps' | 'scanning' | 'success' | 'error' | 'break_loading'
  >('idle')
  const [actionMsg, setActionMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scannerRef = useRef<HTMLDivElement>(null)
  const qrScannerInstanceRef = useRef<{ destroy: () => void } | null>(null)

  const isOnBreak = !!(status?.entry?.break_start && !status?.entry?.break_end)
  const breakAlreadyUsed = !!(status?.entry?.break_start && status?.entry?.break_end)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clock/clock-in', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as ClockStatus
      if (typeof data.clocked_in !== 'boolean') return
      setStatus({
        clocked_in: data.clocked_in,
        entry: data.entry ?? null,
        method: data.method ?? 'manual',
      })
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 60_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchStatus])

  const stopScanner = useCallback(async () => {
    try {
      const instance = qrScannerInstanceRef.current
      if (instance) {
        instance.destroy()
        qrScannerInstanceRef.current = null
      }
    } catch {
      // ignore
    }
    setActionState((s) => (s === 'scanning' ? 'idle' : s))
  }, [])

  useEffect(() => {
    if (!open) void stopScanner()
  }, [open, stopScanner])

  // Elapsed timer (paused during break)
  useEffect(() => {
    if (!status?.clocked_in || !status.entry?.clock_in) {
      setElapsed(0)
      return
    }
    const entry = status.entry
    const update = () => {
      const totalSecs = differenceInSeconds(new Date(), parseISO(entry.clock_in))
      if (entry.break_start && !entry.break_end) {
        const breakSecs = differenceInSeconds(new Date(), parseISO(entry.break_start))
        setElapsed(Math.max(0, totalSecs - breakSecs))
      } else if (entry.break_start && entry.break_end) {
        const breakDuration = differenceInSeconds(parseISO(entry.break_end), parseISO(entry.break_start))
        setElapsed(Math.max(0, totalSecs - breakDuration))
      } else {
        setElapsed(totalSecs)
      }
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [status])

  const doClockAction = useCallback(
    async (payload: { lat?: number; lng?: number; qr_token?: string } = {}) => {
      setActionState('loading')
      try {
        const action = status?.clocked_in ? 'out' : 'in'
        const res = await fetch('/api/clock/clock-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setActionMsg(action === 'in' ? '¡Entrada registrada!' : '¡Salida registrada!')
        setActionState('success')
        window.dispatchEvent(new CustomEvent('clock-status-changed'))
        await fetchStatus()
        setTimeout(() => {
          setActionState('idle')
          setActionMsg('')
          setOpen(false)
        }, 2000)
      } catch (e: unknown) {
        setActionMsg((e as Error).message || 'Error al fichar')
        setActionState('error')
        setTimeout(() => {
          setActionState('idle')
          setActionMsg('')
        }, 4000)
      }
    },
    [status, fetchStatus]
  )

  const doBreakAction = useCallback(async () => {
    setActionState('break_loading')
    try {
      const action = isOnBreak ? 'resume' : 'break'
      const res = await fetch('/api/clock/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setActionMsg(isOnBreak ? '¡Jornada reanudada!' : 'Pausa iniciada')
      setActionState('success')
      await fetchStatus()
      setTimeout(() => {
        setActionState('idle')
        setActionMsg('')
      }, 2000)
    } catch (e: unknown) {
      setActionMsg((e as Error).message || 'Error')
      setActionState('error')
      setTimeout(() => {
        setActionState('idle')
        setActionMsg('')
      }, 4000)
    }
  }, [isOnBreak, fetchStatus])

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setActionMsg('GPS no disponible en este dispositivo')
      setActionState('error')
      setTimeout(() => {
        setActionState('idle')
        setActionMsg('')
      }, 3000)
      return
    }
    setActionState('gps')
    navigator.geolocation.getCurrentPosition(
      (pos) => doClockAction({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setActionMsg('No se pudo obtener la ubicación')
        setActionState('error')
        setTimeout(() => {
          setActionState('idle')
          setActionMsg('')
        }, 4000)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [doClockAction])

  const startQRScanner = useCallback(async () => {
    setActionState('scanning')
    setActionMsg('')
    try {
      const QrScanner = (await import('qr-scanner')).default
      let container = scannerRef.current
      if (!container) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        container = scannerRef.current
      }
      if (!container) {
        setActionState('idle')
        return
      }
      const scanner = new QrScanner(
        container as unknown as HTMLVideoElement,
        async (result) => {
          await stopScanner()
          await doClockAction({ qr_token: result.data })
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      )
      qrScannerInstanceRef.current = scanner
      await scanner.start()
    } catch {
      setActionMsg('No se pudo acceder a la cámara. Comprueba los permisos.')
      setActionState('error')
      setTimeout(() => {
        setActionState('idle')
        setActionMsg('')
      }, 4000)
    }
  }, [doClockAction, stopScanner])

  const method = status?.method ?? 'manual'
  const isClockedIn = status?.clocked_in ?? false
  const isLoading = actionState === 'loading' || actionState === 'gps' || actionState === 'break_loading'
  const statusReady = status !== null
  const showBreakBtn = isClockedIn && !breakAlreadyUsed && actionState !== 'scanning'

  const primaryLabel =
    actionState === 'scanning'
      ? 'Cancelar escaneo'
      : actionState === 'gps'
        ? 'Obteniendo ubicación...'
        : actionState === 'loading'
          ? 'Procesando...'
          : actionState === 'success'
            ? actionMsg
            : isClockedIn
              ? 'Fichar salida'
              : 'Fichar entrada'

  // Shared clock action button renderer
  const renderClockButton = (onClick: () => void, icon: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={isLoading || actionState === 'success' || actionState === 'scanning'}
      className={cn(
        'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer',
        isClockedIn
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-[#3B82F6] hover:bg-blue-500 text-white',
        (isLoading || actionState === 'success' || actionState === 'scanning') && 'opacity-60 cursor-not-allowed'
      )}
    >
      {isLoading && actionState !== 'break_loading' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : actionState === 'success' ? (
        <CheckCircle className="h-4 w-4" />
      ) : icon}
      {primaryLabel}
    </button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all border cursor-pointer',
            isOnBreak
              ? 'bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-950/60'
              : isClockedIn
              ? 'bg-green-950/40 border-green-700/60 text-green-300 hover:bg-green-950/60'
              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          )}
          aria-label="Estado de fichaje"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              isOnBreak ? 'bg-amber-400 animate-pulse' : isClockedIn ? 'bg-green-400 animate-pulse' : 'bg-zinc-500'
            )}
          />
          {isOnBreak ? (
            <span className="hidden sm:inline">En pausa · {formatElapsed(elapsed)}</span>
          ) : isClockedIn ? (
            <span className="hidden sm:inline">Fichado · {formatElapsed(elapsed)}</span>
          ) : (
            <span className="hidden sm:inline">Sin fichar</span>
          )}
          <Clock className="h-3.5 w-3.5 sm:hidden" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/40',
          actionState === 'scanning' ? 'w-[min(100vw-2rem,20rem)]' : 'w-72'
        )}
      >
        <div
          className={cn(
            'rounded-xl p-3 mb-4 text-center',
            isOnBreak
              ? 'bg-amber-950/40 border border-amber-700/40'
              : isClockedIn
              ? 'bg-green-950/40 border border-green-700/40'
              : 'bg-zinc-800/60 border border-zinc-700'
          )}
        >
          <p className={cn('text-xs font-medium', isOnBreak ? 'text-amber-400' : isClockedIn ? 'text-green-400' : 'text-zinc-500')}>
            {isOnBreak ? 'En pausa' : isClockedIn ? 'Jornada en curso' : 'Jornada no iniciada'}
          </p>
          {isClockedIn && (
            <>
              <p className={cn(
                'text-2xl font-mono font-bold tabular-nums mt-1',
                isOnBreak ? 'text-amber-300' : 'text-green-300'
              )}>
                {formatElapsed(elapsed)}
              </p>
              {isOnBreak && status?.entry?.break_start && (
                <p className="text-[10px] text-amber-500/70 mt-0.5">
                  Pausa desde las {format(parseISO(status.entry.break_start), 'HH:mm')}
                </p>
              )}
            </>
          )}
        </div>

        {!statusReady && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        )}

        {statusReady && actionState === 'scanning' && (
          <div className="rounded-xl overflow-hidden border border-zinc-700 relative bg-black mb-3">
            <div ref={scannerRef} className="w-full aspect-square" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <ScanLine className="h-32 w-32 text-blue-400/50" />
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/70 px-2">
              Apunta al QR del local
            </p>
          </div>
        )}

        {/* Break button */}
        {statusReady && showBreakBtn && (
          <button
            onClick={doBreakAction}
            disabled={isLoading || actionState === 'success'}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer mb-2 border',
              isOnBreak
                ? 'bg-amber-500/10 border-amber-600/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700',
              (isLoading || actionState === 'success') && 'opacity-50 cursor-not-allowed'
            )}
          >
            {actionState === 'break_loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOnBreak ? (
              <Play className="h-4 w-4" />
            ) : (
              <Coffee className="h-4 w-4" />
            )}
            {actionState === 'break_loading'
              ? 'Procesando...'
              : isOnBreak
              ? 'Reanudar jornada'
              : 'Iniciar pausa'}
          </button>
        )}

        {/* Main action buttons by method */}
        {statusReady && method === 'gps' && renderClockButton(handleGPS, <MapPin className="h-4 w-4" />)}
        {statusReady && method === 'qr' && renderClockButton(
          () => { if (actionState === 'scanning') void stopScanner(); else void startQRScanner() },
          <QrCode className="h-4 w-4" />
        )}
        {statusReady && method === 'manual' && renderClockButton(
          () => doClockAction(),
          <Clock className="h-4 w-4" />
        )}

        {actionState === 'error' && actionMsg && (
          <p className="mt-3 text-xs text-red-400 text-center">{actionMsg}</p>
        )}

        <div className="mt-3 pt-3 border-t border-zinc-800 text-center">
          <Link
            href="/dashboard/fichar"
            onClick={() => setOpen(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Ver mi jornada completa →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
