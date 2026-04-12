'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordRequirementsList } from '@/components/auth/PasswordRequirementsList'
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle'
import { isValidPassword } from '@/lib/auth-password'

function isCustomResetToken(t: string | null): boolean {
  return Boolean(t && /^[a-f0-9]{64}$/i.test(t))
}

type CustomTokenStatus = 'loading' | 'valid' | 'used' | 'expired' | 'invalid'

const ERROR_MAP: Record<string, string> = {
  weak_password: 'La contraseña no cumple los requisitos mínimos',
}

function mapAuthError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Ha ocurrido un error. Inténtalo de nuevo.'
  const byCode = error.code ? ERROR_MAP[error.code] : null
  if (byCode) return byCode
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('weak password')) return ERROR_MAP.weak_password
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function ResetInfoLinks() {
  return (
    <div className="mt-6 flex flex-col gap-2 text-sm">
      <Link href="/login" className="text-brand hover:underline">
        Ir al inicio de sesión
      </Link>
      <Link href="/forgot-password" className="text-brand hover:underline">
        Solicitar un nuevo enlace
      </Link>
    </div>
  )
}

function ResetPasswordInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenParam = searchParams.get('token')
  const customToken = isCustomResetToken(tokenParam) ? tokenParam! : null
  const malformedTokenParam = Boolean(tokenParam && !customToken)

  const [customStatus, setCustomStatus] = useState<CustomTokenStatus>(() =>
    customToken ? 'loading' : 'valid'
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [legacyRecoveryReady, setLegacyRecoveryReady] = useState(false)
  const [legacyTimedOut, setLegacyTimedOut] = useState(false)
  const disabled = loading

  const readyToSubmit = Boolean(customToken) || legacyRecoveryReady

  useEffect(() => {
    if (!customToken) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/auth/password-reset-token-status?token=${encodeURIComponent(customToken)}`,
          { cache: 'no-store' }
        )
        const data = (await res.json().catch(() => ({}))) as { status?: CustomTokenStatus }
        if (cancelled) return
        const s = data.status
        if (s === 'valid' || s === 'used' || s === 'expired' || s === 'invalid') {
          setCustomStatus(s)
        } else {
          setCustomStatus('invalid')
        }
      } catch {
        if (!cancelled) setCustomStatus('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customToken])

  useEffect(() => {
    if (customToken) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLegacyRecoveryReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setLegacyRecoveryReady(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, customToken])

  useEffect(() => {
    if (customToken || malformedTokenParam) return
    const id = window.setTimeout(() => setLegacyTimedOut(true), 8000)
    return () => window.clearTimeout(id)
  }, [customToken, malformedTokenParam])

  const showLegacyWaiting = !customToken && !malformedTokenParam && !legacyRecoveryReady && !legacyTimedOut
  const showLegacyBadLink = !customToken && !malformedTokenParam && legacyTimedOut && !legacyRecoveryReady

  const showCustomForm = customToken && customStatus === 'valid'
  const showCustomLoading = customToken && customStatus === 'loading'
  const showCustomUsed = customToken && customStatus === 'used'
  const showCustomExpired = customToken && customStatus === 'expired'
  const showCustomInvalid = customToken && customStatus === 'invalid'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setError('')
    setSuccess('')

    if (!isValidPassword(password)) {
      setError('La contraseña no cumple los requisitos mínimos')
      return
    }

    setLoading(true)

    if (customToken) {
      try {
        const res = await fetch('/api/auth/complete-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: customToken, password }),
        })
        const data = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) {
          const code = (data as { code?: string }).code
          if (code === 'USED') {
            setCustomStatus('used')
            setPassword('')
            return
          }
          if (code === 'EXPIRED') {
            setCustomStatus('expired')
            setPassword('')
            return
          }
          if (code === 'INVALID') {
            setCustomStatus('invalid')
            setPassword('')
            return
          }
          const msg =
            typeof (data as { error?: string }).error === 'string'
              ? (data as { error: string }).error
              : 'Enlace inválido o caducado'
          setError(msg)
          setPassword('')
          return
        }
        setSuccess('Contraseña actualizada correctamente. Redirigiendo...')
        setTimeout(() => {
          router.push('/login?success=password_updated')
        }, 1200)
      } catch {
        setLoading(false)
        setError('Ha ocurrido un error. Inténtalo de nuevo.')
      }
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(mapAuthError(updateError))
      setPassword('')
      return
    }

    setSuccess('Contraseña actualizada correctamente. Redirigiendo...')
    setTimeout(() => {
      router.push('/login?success=password_updated')
    }, 1200)
  }

  if (showCustomLoading) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
        <h1 className="font-display mb-2 text-[28px] font-bold text-white">Comprobando enlace</h1>
        <p className="mb-6 flex items-center gap-2 text-[15px] text-[#8e8e93]">
          <Spinner />
          Un momento…
        </p>
      </div>
    )
  }

  if (showCustomUsed) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
        <h1 className="font-display mb-2 text-[28px] font-bold text-white">Enlace ya utilizado</h1>
        <p className="text-[15px] text-[#aeaeb2] leading-relaxed">
          Ya restableciste la contraseña con este enlace. Por seguridad, cada enlace solo sirve una vez.
        </p>
        <p className="mt-3 text-sm text-[#8e8e93]">
          Si necesitas cambiarla otra vez, pide un correo nuevo desde «¿Olvidaste tu contraseña?».
        </p>
        <ResetInfoLinks />
      </div>
    )
  }

  if (showCustomExpired) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
        <h1 className="font-display mb-2 text-[28px] font-bold text-white">Enlace caducado</h1>
        <p className="text-[15px] text-[#aeaeb2] leading-relaxed">
          Este enlace ha superado el tiempo permitido (una hora). Los enlaces de recuperación caducan por seguridad.
        </p>
        <ResetInfoLinks />
      </div>
    )
  }

  if (showCustomInvalid) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
        <h1 className="font-display mb-2 text-[28px] font-bold text-white">Enlace no válido</h1>
        <p className="text-[15px] text-[#aeaeb2] leading-relaxed">
          No podemos validar este enlace. Puede ser incorrecto o haber sido sustituido por uno más reciente.
        </p>
        <ResetInfoLinks />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      <h1 className="font-display mb-2 text-[28px] font-bold text-white">Nueva contraseña</h1>
      <p className="mb-6 text-[15px] text-[#8e8e93]">Introduce tu nueva contraseña para continuar</p>

      {malformedTokenParam && (
        <div className="mb-4 rounded-lg bg-amber-950/40 border border-amber-800/40 p-3 text-sm text-amber-200">
          El enlace no es válido. Solicita un nuevo correo desde «¿Olvidaste tu contraseña?».
        </div>
      )}

      {showLegacyWaiting && (
        <div className="mb-4 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
          Validando enlace de recuperación...
        </div>
      )}

      {showLegacyBadLink && (
        <div className="mb-4 rounded-lg bg-amber-950/40 border border-amber-800/40 p-3 text-sm text-amber-200">
          Este enlace no es válido o ha caducado. Solicita un nuevo correo desde «¿Olvidaste tu contraseña?».
        </div>
      )}

      {(showCustomForm || !customToken) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{success}</div>}

          <div>
            <label htmlFor="password" className="text-sm text-[#aeaeb2]">
              Nueva contraseña
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 pr-10 text-white placeholder:text-[#6b6b6d] outline-none focus:border-brand"
              />
              <PasswordVisibilityToggle
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </div>
            <PasswordRequirementsList password={password} />
          </div>

          <button
            type="submit"
            disabled={disabled || !readyToSubmit || malformedTokenParam}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Spinner />}
            {loading ? 'Actualizando...' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg text-zinc-400 text-sm">
          Cargando…
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  )
}
