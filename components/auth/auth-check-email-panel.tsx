'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Mail } from 'lucide-react'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export type AuthCheckEmailBack =
  | { href: string; label?: string }
  | { onClick: () => void; label?: string }

export type AuthCheckEmailResendResult = { ok: true } | { ok: false; message?: string }

export type AuthCheckEmailPanelProps = {
  email: string
  description: string
  back: AuthCheckEmailBack
  onResend: () => Promise<AuthCheckEmailResendResult>
  /** Si se define, se muestra botón primario bajo el texto */
  continueHref?: string
  continueLabel?: string
  resendCooldownSeconds?: number
}

export function AuthCheckEmailPanel({
  email,
  description,
  back,
  onResend,
  continueHref,
  continueLabel = 'Continuar',
  resendCooldownSeconds = 45,
}: AuthCheckEmailPanelProps) {
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendBanner, setResendBanner] = useState('')
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearCooldownTimer = () => {
    if (cooldownTimer.current) {
      clearInterval(cooldownTimer.current)
      cooldownTimer.current = null
    }
  }

  const startResendCooldown = useCallback((seconds: number) => {
    clearCooldownTimer()
    setResendCooldown(seconds)
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearCooldownTimer()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => clearCooldownTimer(), [])

  const handleResend = async () => {
    if (resendLoading || resendCooldown > 0) return
    setResendLoading(true)
    setResendBanner('')
    try {
      const result = await onResend()
      if (result.ok) {
        setResendBanner('Te hemos vuelto a enviar el correo.')
        startResendCooldown(resendCooldownSeconds)
      } else {
        setResendBanner(
          result.message ??
            'No se pudo reenviar el correo. Inténtalo de nuevo en unos minutos.'
        )
      }
    } catch {
      setResendBanner('Error de red. Inténtalo de nuevo.')
    } finally {
      setResendLoading(false)
    }
  }

  const backLabel = 'label' in back && back.label ? back.label : 'Volver'
  const backClass =
    'mb-8 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-[#f1f0ec]/55 transition-colors hover:text-[#f1f0ec]'

  return (
    <>
      {'href' in back ? (
        <Link href={back.href} className={backClass}>
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>
      ) : (
        <button type="button" onClick={back.onClick} className={backClass}>
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </button>
      )}

      <div className="flex flex-col items-start text-left">
        <Mail className="mb-6 h-8 w-8 text-brand" strokeWidth={1.5} aria-hidden />

        <h1 className="auth-title">Revisa tu correo</h1>
        <p className="mt-2 text-[15px] font-semibold text-[#f1f0ec]/70">{email}</p>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#f1f0ec]/55">{description}</p>

        {resendBanner && (
          <p className="mt-4 text-sm text-[#f1f0ec]/70" role="status">
            {resendBanner}
          </p>
        )}

        {continueHref ? (
          <Link
            href={continueHref}
            className="auth-btn mt-10 max-w-sm"
          >
            {continueLabel}
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={resendLoading || resendCooldown > 0}
          className={`auth-link cursor-pointer text-sm disabled:cursor-not-allowed disabled:opacity-50 ${continueHref ? 'mt-4' : 'mt-10'}`}
        >
          {resendLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Reenviando…
            </span>
          ) : resendCooldown > 0 ? (
            `Reenviar correo (${String(resendCooldown).padStart(2, '0')}s)`
          ) : (
            'Reenviar correo'
          )}
        </button>
      </div>
    </>
  )
}
