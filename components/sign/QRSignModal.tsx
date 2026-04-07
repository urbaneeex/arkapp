'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  /** The staff_signatures.id to generate a QR token for */
  signatureId: string
  /** Called when polling detects the signature is complete */
  onSigned: () => void
  documentLabel?: string
  /** Optional business_id to pass to signatures API when polling */
  businessId?: string
}

type State = 'loading' | 'ready' | 'signed' | 'expired' | 'error'

export default function QRSignModal({
  open,
  onClose,
  signatureId,
  onSigned,
  documentLabel,
  businessId,
}: Props) {
  const [state, setState] = useState<State>('loading')
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(600)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (countRef.current) clearInterval(countRef.current)
  }

  // Generate session token when modal opens
  useEffect(() => {
    if (!open) return
    setState('loading')
    setToken(null)
    setExpiresAt(null)

    fetch('/api/sign/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature_id: signatureId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.token) {
          setToken(data.token)
          const exp = new Date(data.expiresAt)
          setExpiresAt(exp)
          const secs = Math.floor((exp.getTime() - Date.now()) / 1000)
          setSecondsLeft(secs)
          setState('ready')
        } else {
          setState('error')
        }
      })
      .catch(() => setState('error'))

    return clearTimers
  }, [open, signatureId])

  // Countdown timer
  useEffect(() => {
    if (state !== 'ready' || !expiresAt) return
    countRef.current = setInterval(() => {
      const secs = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      if (secs <= 0) {
        setState('expired')
        clearTimers()
      } else {
        setSecondsLeft(secs)
      }
    }, 1000)
    return () => { if (countRef.current) clearInterval(countRef.current) }
  }, [state, expiresAt])

  // Poll for signature status every 3 seconds using the token
  useEffect(() => {
    if (state !== 'ready' || !token) return
    pollRef.current = setInterval(async () => {
      try {
        // If the session returns 409 or "used/signed", the signature is complete
        const r = await fetch(`/api/sign/session?token=${encodeURIComponent(token)}`)
        if (r.status === 409 || r.status === 410) {
          // Could be signed or just token used — check via signatures API if businessId available
          if (businessId) {
            const sr = await fetch(`/api/staff/signatures?business_id=${businessId}`)
            const sd = await sr.json()
            const found = Array.isArray(sd.data)
              ? sd.data.find((s: { id: string; status: string }) => s.id === signatureId)
              : null
            if (found?.status !== 'signed') return
          }
          setState('signed')
          clearTimers()
          setTimeout(onSigned, 1500)
          return
        }
        // If still valid, keep polling
        const data = await r.json()
        if (data.error === 'Ya firmado') {
          setState('signed')
          clearTimers()
          setTimeout(onSigned, 1500)
        }
      } catch {
        // ignore polling errors silently
      }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [state, token, signatureId, onSigned, businessId])

  const signUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sign/${token}`
    : ''

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { clearTimers(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Firmar con móvil
          </DialogTitle>
          {documentLabel && (
            <DialogDescription>{documentLabel}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generando código QR...</p>
            </div>
          )}

          {state === 'ready' && token && (
            <>
              <div className="rounded-xl border p-3 bg-white shadow-sm">
                <QRCodeSVG value={signUrl} size={200} />
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-xs">
                Escanea este código con tu móvil y firma con el dedo.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">
                  Esperando firma… expira en{' '}
                  <span className={secondsLeft < 60 ? 'text-destructive font-semibold' : 'font-mono'}>
                    {formatTime(secondsLeft)}
                  </span>
                </span>
              </div>
            </>
          )}

          {state === 'signed' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <p className="text-base font-semibold">¡Documento firmado!</p>
              <p className="text-sm text-muted-foreground">Cerrando...</p>
            </div>
          )}

          {state === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-base font-semibold text-destructive">Código expirado</p>
              <p className="text-sm text-muted-foreground">El código QR ha caducado.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setState('loading')
                  setToken(null)
                  fetch('/api/sign/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signature_id: signatureId }),
                  })
                    .then(r => r.json())
                    .then(data => {
                      if (data.token) {
                        setToken(data.token)
                        const exp = new Date(data.expiresAt)
                        setExpiresAt(exp)
                        setSecondsLeft(Math.floor((exp.getTime() - Date.now()) / 1000))
                        setState('ready')
                      } else setState('error')
                    })
                    .catch(() => setState('error'))
                }}
              >
                Generar nuevo código
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center py-4">
              <p className="text-sm text-destructive">Error al generar el código. Inténtalo de nuevo.</p>
              <Button variant="ghost" className="mt-2" onClick={onClose}>Cerrar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
