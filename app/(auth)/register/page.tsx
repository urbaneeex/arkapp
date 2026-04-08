'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useToastFeedback } from '@/hooks/use-toast-feedback'
import { GoogleBrandIcon } from '@/components/auth/GoogleBrandIcon'
import { PasswordRequirementsList } from '@/components/auth/PasswordRequirementsList'
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle'
import { isValidPassword } from '@/lib/auth-password'
const ERROR_MAP: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos',
  email_not_confirmed: 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese email',
  weak_password: 'La contraseña no cumple los requisitos mínimos',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  email_address_not_authorized: 'Este email no está autorizado. Usa otro email.',
  signup_disabled: 'El registro está desactivado temporalmente. Inténtalo más tarde.',
  anonymous_provider_disabled: 'Registro no disponible. Usa Google o contacta soporte.',
}

function mapAuthError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Ha ocurrido un error. Inténtalo de nuevo.'
  const byCode = error.code ? ERROR_MAP[error.code] : null
  if (byCode) return byCode
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('signups not allowed') || message.includes('signup is disabled')) return ERROR_MAP.signup_disabled
  if (message.includes('email provider is disabled')) return 'El registro por email está desactivado en Supabase.'
  if (message.includes('redirect url') || message.includes('not allowed redirect')) return 'URL de redirección no permitida. Revisa la configuración de Supabase.'
  if (message.includes('rate limit')) return ERROR_MAP.over_email_send_rate_limit
  if (message.includes('network')) return 'Error de red al registrar. Verifica tu conexión e inténtalo de nuevo.'
  if (message.includes('already registered') || message.includes('already exists')) return ERROR_MAP.user_already_exists
  if (message.includes('weak password')) return ERROR_MAP.weak_password
  if (message.trim().length > 0) return error.message as string
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

export default function RegisterPage() {
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const oauthRedirect = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined),
    []
  )
  const inCooldown = Date.now() < cooldownUntil
  const disabled = loading || inCooldown
  useToastFeedback({ error, success })

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
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      })
      setLoading(false)

      if (signUpError) {
        console.warn('[register] signUpError raw:', signUpError)
        console.warn('[register] signUpError:', {
          code: signUpError.code,
          message: signUpError.message,
          status: (signUpError as { status?: number }).status,
        })
        setError(mapAuthError(signUpError))
        setPassword('')
        setCooldownUntil(Date.now() + 3000)
        return
      }
    } catch (unexpectedError) {
      setLoading(false)
      console.warn('[register] unexpected signUp error:', unexpectedError)
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
      setPassword('')
      setCooldownUntil(Date.now() + 3000)
      return
    }

    setSuccess('Revisa tu email para confirmar tu cuenta')
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
      <h1 className="mb-2 text-[28px] font-bold text-white">Crear cuenta</h1>
      <p className="mb-6 text-[15px] text-[#8e8e93]">Empieza con Arkapp en segundos</p>

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
        {error && <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{success}</div>}

        <div>
          <label htmlFor="fullName" className="text-sm text-[#aeaeb2]">
            Nombre completo
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div>
          <label htmlFor="email" className="text-sm text-[#aeaeb2]">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm text-[#aeaeb2]">
            Contraseña
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 pr-10 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
            />
            <PasswordVisibilityToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
          <PasswordRequirementsList password={password} />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Creando cuenta...' : inCooldown ? 'Espera 3 segundos...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#8e8e93]">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#3b82f6] hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
