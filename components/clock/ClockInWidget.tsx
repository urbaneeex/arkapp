'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, differenceInSeconds, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, MapPin, QrCode, CheckCircle, XCircle, Loader2, ScanLine, Coffee, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

type OpenEntry = {
  id: string
  clock_in: string
  source: string
  break_start?: string | null
  break_end?: string | null
}
type ClockInMethod = 'manual' | 'qr' | 'gps'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ClockInWidget({
  userName,
  businessName,
  clockInMethod,
  geofenceRadius,
  openEntry: initialOpenEntry,
}: {
  userName: string
  businessName: string
  clockInMethod: ClockInMethod
  geofenceRadius: number
  openEntry: OpenEntry | null
}) {
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(initialOpenEntry)
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'gps' | 'success' | 'error' | 'break_loading'>('idle')
  const [message, setMessage] = useState('')
  const scannerRef = useRef<HTMLDivElement>(null)
  const qrScannerInstanceRef = useRef<unknown>(null)

  const isOnBreak = !!(openEntry?.break_start && !openEntry?.break_end)

  // Tick elapsed time when clocked in (pause timer during break)
  useEffect(() => {
    if (!openEntry) return
    const update = () => {
      const totalSecs = differenceInSeconds(new Date(), parseISO(openEntry.clock_in))
      if (openEntry.break_start && !openEntry.break_end) {
        // On break: freeze elapsed at break_start moment
        const breakSecs = differenceInSeconds(new Date(), parseISO(openEntry.break_start))
        setElapsed(Math.max(0, totalSecs - breakSecs))
      } else if (openEntry.break_start && openEntry.break_end) {
        // Break finished: subtract break duration
        const breakDuration = differenceInSeconds(parseISO(openEntry.break_end), parseISO(openEntry.break_start))
        setElapsed(Math.max(0, totalSecs - breakDuration))
      } else {
        setElapsed(totalSecs)
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [openEntry])

  const stopScanner = useCallback(async () => {
    try {
      const instance = qrScannerInstanceRef.current as { destroy: () => void } | null
      if (instance) {
        instance.destroy()
        qrScannerInstanceRef.current = null
      }
    } catch {
      // ignore
    }
    setStatus('idle')
  }, [])

  const handleClockIn = useCallback(async (payload: { qr_token?: string; lat?: number; lng?: number }) => {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/clock/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: openEntry ? 'out' : 'in', ...payload }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      if (json.action === 'clocked_in') {
        setOpenEntry({
          id: json.data.id,
          clock_in: json.data.clock_in,
          source: json.data.source ?? '',
          break_start: null,
          break_end: null,
        })
        setMessage('¡Entrada registrada!')
      } else {
        setOpenEntry(null)
        setElapsed(0)
        setMessage('¡Salida registrada!')
      }
      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e: unknown) {
      setMessage((e as Error).message || 'Error desconocido')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }, [openEntry])

  const handleBreak = useCallback(async () => {
    setStatus('break_loading')
    setMessage('')
    try {
      const action = isOnBreak ? 'resume' : 'break'
      const res = await fetch('/api/clock/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      if (json.action === 'break_started') {
        setOpenEntry(prev => prev ? { ...prev, break_start: json.data.break_start, break_end: null } : prev)
        setMessage('Pausa iniciada')
      } else {
        setOpenEntry(prev => prev ? { ...prev, break_end: json.data.break_end } : prev)
        setMessage('¡Jornada reanudada!')
      }
      setStatus('success')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (e: unknown) {
      setMessage((e as Error).message || 'Error desconocido')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }, [isOnBreak])

  const startQRScanner = useCallback(async () => {
    setStatus('scanning')
    setMessage('')
    try {
      const QrScanner = (await import('qr-scanner')).default
      if (!scannerRef.current) return

      const scanner = new QrScanner(
        scannerRef.current as unknown as HTMLVideoElement,
        async (result) => {
          await stopScanner()
          await handleClockIn({ qr_token: result.data })
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
      setStatus('error')
      setMessage('No se pudo acceder a la cámara. Comprueba los permisos.')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }, [handleClockIn, stopScanner])

  const handleGPS = useCallback(() => {
    setStatus('gps')
    setMessage('')
    if (!navigator.geolocation) {
      setStatus('error')
      setMessage('Tu dispositivo no soporta geolocalización.')
      setTimeout(() => setStatus('idle'), 4000)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handleClockIn({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setStatus('error')
        setMessage(
          err.code === 1
            ? 'Permiso de ubicación denegado. Actívalo en la configuración del navegador.'
            : 'No se pudo obtener la ubicación. Inténtalo de nuevo.'
        )
        setTimeout(() => setStatus('idle'), 5000)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [handleClockIn])

  const handleMainAction = useCallback(() => {
    if (status === 'loading' || status === 'gps' || status === 'break_loading') return

    if (clockInMethod === 'qr') {
      if (status === 'scanning') {
        stopScanner()
        return
      }
      startQRScanner()
    } else if (clockInMethod === 'gps') {
      handleGPS()
    } else {
      // manual — one tap is enough, session = identity
      handleClockIn({})
    }
  }, [status, clockInMethod, startQRScanner, stopScanner, handleGPS, handleClockIn])

  const isClockedIn = !!openEntry
  const isLoading = status === 'loading' || status === 'gps' || status === 'break_loading'
  // Break button is only available once per entry and when clocked in
  const breakAlreadyUsed = !!(openEntry?.break_start && openEntry?.break_end)
  const showBreakButton = isClockedIn && !breakAlreadyUsed && status !== 'scanning'

  const buttonLabel = () => {
    if (status === 'scanning') return 'Cancelar escaneo'
    if (status === 'gps') return 'Obteniendo ubicación...'
    if (status === 'loading') return 'Procesando...'
    if (isClockedIn) return 'Fichar salida'
    return 'Fichar entrada'
  }

  const methodIcon = clockInMethod === 'qr' ? QrCode : clockInMethod === 'gps' ? MapPin : Clock

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <p className="text-zinc-400 text-sm">{businessName}</p>
        <h1 className="font-display text-2xl font-bold text-zinc-100 mt-1">{userName}</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Status card */}
      <div className={cn(
        'rounded-2xl border p-6 text-center transition-all',
        isOnBreak
          ? 'bg-amber-950/30 border-amber-700/50'
          : isClockedIn
          ? 'bg-green-950/30 border-green-700/50'
          : 'bg-zinc-900 border-zinc-800'
      )}>
        <div className={cn(
          'text-sm font-medium mb-1',
          isOnBreak ? 'text-amber-400' : isClockedIn ? 'text-green-400' : 'text-zinc-500'
        )}>
          {isOnBreak ? 'En pausa' : isClockedIn ? 'Fichado — en el trabajo' : 'Sin fichar'}
        </div>

        {isClockedIn ? (
          <>
            <div className={cn(
              'text-4xl font-mono font-bold tabular-nums mt-2',
              isOnBreak ? 'text-amber-300' : 'text-green-300'
            )}>
              {formatElapsed(elapsed)}
            </div>
            <div className="text-xs text-zinc-500 mt-2 space-y-0.5">
              <div>
                Entrada a las {format(parseISO(openEntry.clock_in), 'HH:mm')}
                {openEntry.source && openEntry.source !== 'manual' && (
                  <span className="ml-2 text-zinc-600 capitalize">· {openEntry.source}</span>
                )}
              </div>
              {isOnBreak && openEntry.break_start && (
                <div className="text-amber-500/70">
                  Pausa desde las {format(parseISO(openEntry.break_start), 'HH:mm')}
                </div>
              )}
              {breakAlreadyUsed && openEntry.break_start && openEntry.break_end && (
                <div className="text-zinc-600">
                  Pausa: {format(parseISO(openEntry.break_start), 'HH:mm')} – {format(parseISO(openEntry.break_end), 'HH:mm')}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-zinc-600 mt-2 text-sm">
            Pulsa el botón para registrar tu entrada
          </div>
        )}
      </div>

      {/* QR Scanner viewfinder */}
      {status === 'scanning' && (
        <div className="rounded-xl overflow-hidden border border-zinc-700 relative bg-black">
          <div ref={scannerRef as React.RefObject<HTMLDivElement>} className="w-full aspect-square" />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <ScanLine className="h-48 w-48 text-brand/60" />
          </div>
          <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/70">
            Apunta la cámara al código QR del local
          </p>
        </div>
      )}

      {/* Feedback message */}
      {(status === 'success' || status === 'error') && message && (
        <div className={cn(
          'flex items-center gap-3 rounded-xl p-4 text-sm',
          status === 'success'
            ? 'bg-green-950/40 border border-green-700/50 text-green-300'
            : 'bg-red-950/40 border border-red-700/50 text-red-300'
        )}>
          {status === 'success'
            ? <CheckCircle className="h-5 w-5 shrink-0" />
            : <XCircle className="h-5 w-5 shrink-0" />
          }
          {message}
        </div>
      )}

      {/* Break button (secondary) */}
      {showBreakButton && (
        <button
          onClick={handleBreak}
          disabled={isLoading || status === 'success'}
          className={cn(
            'w-full py-3.5 rounded-2xl text-base font-semibold transition-all active:scale-[0.98]',
            'flex items-center justify-center gap-2 border',
            isOnBreak
              ? 'bg-amber-500/10 border-amber-600/40 text-amber-300 hover:bg-amber-500/20'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700',
            (isLoading || status === 'success') && 'opacity-50 cursor-not-allowed'
          )}
        >
          {status === 'break_loading' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isOnBreak ? (
            <Play className="h-5 w-5" />
          ) : (
            <Coffee className="h-5 w-5" />
          )}
          {status === 'break_loading'
            ? 'Procesando...'
            : isOnBreak
            ? 'Reanudar jornada'
            : 'Iniciar pausa'}
        </button>
      )}

      {/* Main action button */}
      <button
        onClick={handleMainAction}
        disabled={isLoading || status === 'success'}
        className={cn(
          'w-full py-5 rounded-2xl text-lg font-semibold transition-all active:scale-[0.98]',
          'flex items-center justify-center gap-3 min-h-[72px]',
          status === 'scanning'
            ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
            : isClockedIn
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-brand hover:bg-brand-hover text-white',
          (isLoading || status === 'success') && 'opacity-60 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : status === 'success' ? (
          <CheckCircle className="h-6 w-6" />
        ) : (
          (() => {
            const Icon = methodIcon
            return <Icon className="h-6 w-6" />
          })()
        )}
        {buttonLabel()}
      </button>

      {/* Method info */}
      <p className="text-center text-xs text-zinc-600">
        {clockInMethod === 'qr' && 'Verificación por código QR'}
        {clockInMethod === 'gps' && `Verificación por GPS · Radio ${geofenceRadius} m`}
        {clockInMethod === 'manual' && 'Fichaje por sesión — un toque para registrar'}
      </p>
    </div>
  )
}
