'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { RefreshCw, Settings, Wifi } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const TOKEN_TTL = 120 // seconds
const REFRESH_AT = 90 // refresh token 30s before expiry

export function QRClockDisplay({
  businessId,
  businessName,
  clockInMethod,
}: {
  businessId: string
  businessName: string
  clockInMethod: 'manual' | 'qr' | 'gps'
}) {
  const [token, setToken] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(TOKEN_TTL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState(Date.now())

  const fetchToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clock/qr-token')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setToken(json.token)
      setCountdown(TOKEN_TTL)
      setLastRefreshed(Date.now())
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (clockInMethod === 'qr') fetchToken()
  }, [fetchToken, clockInMethod])

  // Auto-refresh every REFRESH_AT seconds
  useEffect(() => {
    if (clockInMethod !== 'qr') return
    const interval = setInterval(fetchToken, REFRESH_AT * 1000)
    return () => clearInterval(interval)
  }, [fetchToken, clockInMethod])

  // Countdown ticker
  useEffect(() => {
    if (clockInMethod !== 'qr') return
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastRefreshed) / 1000)
      setCountdown(Math.max(0, TOKEN_TTL - elapsed))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastRefreshed, clockInMethod])

  if (clockInMethod !== 'qr') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <Wifi className="h-12 w-12 text-zinc-600" />
        <h2 className="text-xl font-semibold text-zinc-300">
          El método de fichaje no es QR
        </h2>
        <p className="text-zinc-500 max-w-sm">
          El método configurado actualmente es{' '}
          <strong className="text-zinc-300">
            {clockInMethod === 'gps' ? 'GPS' : 'Manual'}
          </strong>
          . Para usar esta pantalla cambia el método en Ajustes.
        </p>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
        >
          <Settings className="h-4 w-4" />
          Ir a Ajustes
        </Link>
      </div>
    )
  }

  const pct = ((countdown / TOKEN_TTL) * 100)
  const urgentColor = countdown <= 20 ? 'text-red-400' : countdown <= 40 ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-100">{businessName}</h1>
        <p className="text-zinc-400 mt-1">Escanea el código para fichar</p>
      </div>

      <div className="relative">
        {/* Circular progress ring */}
        <svg className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-800" />
          <circle
            cx="50" cy="50" r="48" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 48}`}
            strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
            className={cn('transition-all duration-1000', urgentColor)}
          />
        </svg>

        <div className="bg-white p-4 rounded-xl shadow-2xl">
          {loading ? (
            <div className="w-64 h-64 flex items-center justify-center bg-zinc-100 rounded">
              <RefreshCw className="h-8 w-8 text-zinc-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="w-64 h-64 flex flex-col items-center justify-center gap-3 bg-red-50 rounded p-4 text-center">
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={fetchToken}
                className="text-xs text-red-600 underline"
              >
                Reintentar
              </button>
            </div>
          ) : token ? (
            <QRCodeSVG
              value={token}
              size={256}
              level="M"
              includeMargin={false}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={cn('text-3xl font-mono font-bold tabular-nums', urgentColor)}>
          {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
        </span>
        <button
          onClick={fetchToken}
          disabled={loading}
          className="p-2 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          title="Actualizar ahora"
        >
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
        </button>
      </div>

      <p className="text-xs text-zinc-600 text-center max-w-xs">
        El código se actualiza automáticamente cada {REFRESH_AT} segundos para mayor seguridad.
        Los empleados deben escanearlo desde su pantalla de fichaje.
      </p>

      <Link
        href="/dashboard/settings"
        className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1"
      >
        <Settings className="h-3 w-3" />
        Configurar método de fichaje
      </Link>
    </div>
  )
}
