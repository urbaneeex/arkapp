'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useToastFeedback } from '@/hooks/use-toast-feedback'
import { GoogleBrandIcon } from '@/components/auth/GoogleBrandIcon'

const ERROR_MAP: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos',
  email_not_confirmed: 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese email',
  weak_password: 'La contraseña no cumple los requisitos mínimos',
}

function mapAuthError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Ha ocurrido un error. Inténtalo de nuevo.'
  const byCode = error.code ? ERROR_MAP[error.code] : null
  if (byCode) return byCode
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('invalid login credentials')) return ERROR_MAP.invalid_credentials
  if (message.includes('email not confirmed')) return ERROR_MAP.email_not_confirmed
  if (message.includes('already registered')) return ERROR_MAP.user_already_exists
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

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const inCooldown = Date.now() < cooldownUntil
  const disabled = loading || inCooldown
  const oauthRedirect = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined),
    []
  )
  const querySuccess = searchParams.get('success')
  const queryError = searchParams.get('error')
  useToastFeedback({ error, success })

  useEffect(() => {
    if (querySuccess === 'password_updated') {
      toast.success('Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.')
    }
  }, [querySuccess])

  useEffect(() => {
    if (queryError === 'auth_callback_failed') {
      toast.error('No pudimos completar la autenticación. Inténtalo de nuevo.')
    }
  }, [queryError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setLoading(true)
    setError('')
    setSuccess('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (err) {
      setError(mapAuthError(err))
      setPassword('')
      setCooldownUntil(Date.now() + 3000)
      return
    }
    router.push('/dashboard/calendar')
    router.refresh()
  }

  const signInWithGoogle = async () => {
    if (disabled) return
    setError('')
    setSuccess('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirect,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    })
    if (oauthError) {
      setError(mapAuthError(oauthError))
      setCooldownUntil(Date.now() + 3000)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      <h1 className="mb-2 text-[28px] font-bold text-white">Iniciar sesión</h1>
      <p className="mb-6 text-[15px] text-[#8e8e93]">Accede a tu panel de citas</p>

      <div className="space-y-3">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={disabled}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#3a3a3c] bg-[#2c2c2e] text-sm font-medium text-white transition-colors hover:bg-[#3a3a3c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleBrandIcon />
          Continuar con Google
        </button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-[#8e8e93]">
        <span className="h-px flex-1 bg-[#3a3a3c]" />
        <span>o continúa con email</span>
        <span className="h-px flex-1 bg-[#3a3a3c]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {(success || querySuccess === 'password_updated') && (
          <div className="rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">
            {success || 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.'}
          </div>
        )}
        {queryError === 'auth_callback_failed' && (
          <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
            No pudimos completar la autenticación. Inténtalo de nuevo.
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>
        )}
        <div>
          <label htmlFor="email" className="text-sm text-[#aeaeb2]">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            className="mt-1 h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm text-[#aeaeb2]">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
          />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-[#3b82f6] hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Entrando...' : inCooldown ? 'Espera 3 segundos...' : 'Entrar'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#8e8e93]">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-[#3b82f6] hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
