'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { AuthCheckEmailPanel } from '@/components/auth/auth-check-email-panel'
import { GoogleBrandIcon } from '@/components/auth/GoogleBrandIcon'
import { PasswordRequirementsList } from '@/components/auth/PasswordRequirementsList'
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle'
import { AuthLegalFooter, AuthMethodButton, AuthOrDivider } from '@/components/auth/auth-method-ui'
import { isValidPassword } from '@/lib/auth-password'

const LOGIN_ERROR_MAP: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos',
  email_not_confirmed: 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese email',
  weak_password: 'La contraseña no cumple los requisitos mínimos',
}

const REGISTER_ERROR_MAP: Record<string, string> = {
  ...LOGIN_ERROR_MAP,
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  email_address_not_authorized: 'Este email no está autorizado. Usa otro email.',
  signup_disabled: 'El registro está desactivado temporalmente. Inténtalo más tarde.',
  anonymous_provider_disabled: 'Registro no disponible. Usa Google o contacta soporte.',
}

function mapLoginError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Ha ocurrido un error. Inténtalo de nuevo.'
  const byCode = error.code ? LOGIN_ERROR_MAP[error.code] : null
  if (byCode) return byCode
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('invalid login credentials')) return LOGIN_ERROR_MAP.invalid_credentials
  if (message.includes('email not confirmed')) return LOGIN_ERROR_MAP.email_not_confirmed
  if (message.includes('already registered')) return LOGIN_ERROR_MAP.user_already_exists
  if (message.includes('weak password')) return LOGIN_ERROR_MAP.weak_password
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}

function mapOAuthError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Ha ocurrido un error. Inténtalo de nuevo.'
  const message = (error.message ?? '').toLowerCase()
  if (message.includes('redirect url') || message.includes('not allowed redirect'))
    return 'URL de redirección no permitida. Revisa la configuración de Supabase.'
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

type MailUi =
  | 'button'
  | 'email_entry'
  | 'google_only'
  | 'password_login'
  | 'password_signup'
  | 'signup_check_email'

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mailUi, setMailUi] = useState<MailUi>('button')
  const [emailDraft, setEmailDraft] = useState('')
  const [emailLocked, setEmailLocked] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [emailVerifiedNotice, setEmailVerifiedNotice] = useState(false)

  const disabled = loading
  const oauthRedirect = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm` : undefined),
    []
  )

  const querySuccess = searchParams.get('success')
  const queryError = searchParams.get('error')
  const detailParam = searchParams.get('detail')
  const callbackDetail = useMemo(() => {
    if (!detailParam) return null
    try {
      return decodeURIComponent(detailParam).replace(/\+/g, ' ').slice(0, 400)
    } catch {
      return detailParam.slice(0, 400)
    }
  }, [detailParam])
  const registerQ = searchParams.get('register') === '1'
  const emailQ = searchParams.get('email') === '1'

  useEffect(() => {
    if (!registerQ && !emailQ) return
    setMailUi('email_entry')
    router.replace('/login', { scroll: false })
  }, [registerQ, emailQ, router])

  useEffect(() => {
    if (searchParams.get('success') !== 'email_verified') return
    setEmailVerifiedNotice(true)
    router.replace('/login', { scroll: false })
  }, [searchParams, router])

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
      setError(mapOAuthError(oauthError))
    }
  }

  const backToEmailEntry = () => {
    setMailUi('email_entry')
    setEmailDraft(emailLocked)
    setEmailLocked('')
    setPassword('')
    setAcceptedLegal(false)
    setError('')
    setSuccess('')
  }

  const runEmailLookup = async () => {
    const e = emailDraft.trim().toLowerCase()
    if (!e || !e.includes('@')) {
      setError('Introduce un correo electrónico válido.')
      return
    }
    setLookupLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/lookup-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = (await res.json()) as { ok?: boolean; status?: string; error?: string }

      if (res.status === 429) {
        setError('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
        return
      }
      if (!res.ok || !data.ok) {
        setError('No se pudo comprobar el correo. Inténtalo de nuevo.')
        return
      }

      setEmailLocked(e)
      if (data.status === 'new') {
        setMailUi('password_signup')
      } else if (data.status === 'password') {
        setMailUi('password_login')
      } else {
        setMailUi('google_only')
      }
    } catch {
      setError('No se pudo comprobar el correo. Inténtalo de nuevo.')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setLoading(true)
    setError('')
    setSuccess('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: emailLocked,
      password,
    })
    setLoading(false)
    if (err) {
      setError(mapLoginError(err))
      setPassword('')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setError('')
    setSuccess('')

    if (!isValidPassword(password)) {
      setError('La contraseña no cumple los requisitos mínimos')
      return
    }
    if (!acceptedLegal) {
      setError('Debes aceptar la política y los términos para crear la cuenta.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailLocked,
          password,
          terms_accepted_at: new Date().toISOString(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        code?: string
        message?: string
      }
      setLoading(false)

      if (!res.ok || data.ok !== true) {
        const code = data.code ?? ''
        if (code === 'user_already_exists') {
          setError(REGISTER_ERROR_MAP.user_already_exists)
        } else if (code === 'weak_password') {
          setError(data.message ?? REGISTER_ERROR_MAP.weak_password)
        } else if (code === 'rate_limited') {
          setError(data.message ?? REGISTER_ERROR_MAP.over_email_send_rate_limit)
        } else if (code === 'email_send_failed' || code === 'server_config') {
          setError(data.message ?? 'No se pudo completar el registro. Inténtalo más tarde.')
        } else if (code === 'invalid_email') {
          setError(data.message ?? 'Introduce un email válido.')
        } else {
          setError(data.message ?? 'Ha ocurrido un error. Inténtalo de nuevo.')
        }
        setPassword('')
        return
      }

      setPassword('')
      setSuccess('')
      setError('')
      setMailUi('signup_check_email')
    } catch {
      setLoading(false)
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
      setPassword('')
      return
    }
  }

  const resendSignupConfirmation = async (): Promise<
    { ok: true } | { ok: false; message?: string }
  > => {
    if (!emailLocked) return { ok: false, message: 'Falta el correo.' }
    try {
      const res = await fetch('/api/auth/resend-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLocked }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
      }
      if (data.ok === true) return { ok: true }
      return { ok: false, message: data.message }
    } catch {
      return { ok: false, message: 'Error de red. Inténtalo de nuevo.' }
    }
  }

  const showBackToWelcome =
    mailUi !== 'button' &&
    mailUi !== 'email_entry' &&
    mailUi !== 'google_only' &&
    mailUi !== 'signup_check_email'
  const signupFormValid = isValidPassword(password) && acceptedLegal
  const showHero =
    mailUi === 'button' || mailUi === 'email_entry' || mailUi === 'google_only'

  return (
    <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      {mailUi === 'signup_check_email' ? (
        <AuthCheckEmailPanel
          email={emailLocked}
          description="Te hemos enviado un correo electrónico para confirmar que eres tú. Sigue las instrucciones que verás para continuar. Si no lo ves, revisa la carpeta de spam."
          back={{ onClick: backToEmailEntry }}
          onResend={resendSignupConfirmation}
        />
      ) : (
        <>
      {showBackToWelcome && (
        <button
          type="button"
          onClick={backToEmailEntry}
          className="mb-4 flex cursor-pointer items-center gap-1 text-sm text-[#8e8e93] transition-colors hover:text-white"
        >
          ← Volver
        </button>
      )}

      {showHero && (
        <>
          <h1 className="mb-2 text-center text-[26px] font-bold leading-tight text-white sm:text-[28px]">
            Te damos la bienvenida a Arkapp
          </h1>
          <p className="mb-6 text-center text-[15px] text-[#8e8e93]">Inicia sesión o crea cuenta</p>
        </>
      )}

      {(querySuccess === 'password_updated' || (success && mailUi === 'password_login')) && (
        <div className="mb-4 rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">
          {querySuccess === 'password_updated'
            ? 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.'
            : success}
        </div>
      )}
      {emailVerifiedNotice && (
        <div className="mb-4 rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">
          Correo confirmado. Ya puedes iniciar sesión con tu email y contraseña.
        </div>
      )}
      {queryError === 'verify_failed' && (
        <div className="mb-4 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
          <p>No pudimos verificar el correo.</p>
          {callbackDetail ? (
            <p className="mt-2 whitespace-pre-wrap text-red-200/90">{callbackDetail}</p>
          ) : (
            <p className="mt-1 text-red-300/90">Solicita un nuevo enlace desde la pantalla de registro.</p>
          )}
        </div>
      )}
      {queryError === 'auth_callback_failed' && (
        <div className="mb-4 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
          <p>No pudimos completar la autenticación.</p>
          {callbackDetail ? (
            <p className="mt-2 whitespace-pre-wrap text-red-200/90">{callbackDetail}</p>
          ) : (
            <p className="mt-1 text-red-300/90">Inténtalo de nuevo o entra con email y contraseña.</p>
          )}
        </div>
      )}
      {error && <div className="mb-4 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}

      {mailUi !== 'password_signup' && mailUi !== 'password_login' && (
        <>
          <div className="space-y-3">
            <AuthMethodButton icon={<GoogleBrandIcon />} onClick={signInWithGoogle} disabled={disabled}>
              Continuar con Google
            </AuthMethodButton>
          </div>

          <AuthOrDivider />
        </>
      )}

      {(mailUi === 'button' || mailUi === 'email_entry' || mailUi === 'google_only') && (
        <>
          {mailUi === 'button' && (
            <div className="space-y-3">
              <AuthMethodButton
                icon={<Mail className="h-5 w-5 text-[#aeaeb2]" strokeWidth={1.75} aria-hidden />}
                onClick={() => {
                  setError('')
                  setSuccess('')
                  setMailUi('email_entry')
                }}
                disabled={disabled}
              >
                Continuar con correo
              </AuthMethodButton>
            </div>
          )}

          {(mailUi === 'email_entry' || mailUi === 'google_only') && (
            <div className="flex flex-col">
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value)
                  if (mailUi === 'google_only') {
                    setMailUi('email_entry')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void runEmailLookup()
                  }
                }}
                placeholder="Correo electrónico"
                autoComplete="email"
                autoFocus={mailUi === 'email_entry'}
                className="h-12 w-full rounded-xl border border-[#3a3a3c] bg-[#2c2c2e] px-4 text-sm text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
              />
              {mailUi === 'google_only' && (
                <div className="mt-3 text-sm leading-relaxed text-[#aeaeb2]">
                  <p className="font-medium text-[#e8e8ed]">Cuenta registrada con Google</p>
                  <p className="mt-2">
                    Para acceder a tu cuenta, presiona{' '}
                    <span className="font-semibold text-white">«Continuar con Google»</span>.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => void runEmailLookup()}
                disabled={lookupLoading || !emailDraft.trim().includes('@')}
                className="mt-8 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lookupLoading && <Spinner />}
                {lookupLoading ? 'Comprobando...' : 'Continuar'}
              </button>
            </div>
          )}
        </>
      )}

      {mailUi === 'password_login' && (
        <form onSubmit={handleLoginSubmit} className="mt-4 space-y-4">
          <h1 className="mb-6 text-center text-[26px] font-bold leading-tight text-white sm:text-[28px]">
            Indica tu contraseña
          </h1>
          <div>
            <label htmlFor="locked-email-login" className="text-sm text-[#aeaeb2]">
              Correo electrónico
            </label>
            <input
              id="locked-email-login"
              type="email"
              value={emailLocked}
              readOnly
              tabIndex={-1}
              className="mt-1 h-11 w-full cursor-default rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e]/80 px-3 text-[#aeaeb2] outline-none"
            />
          </div>
          <div>
            <label htmlFor="password-login" className="text-sm text-[#aeaeb2]">
              Contraseña
            </label>
            <div className="relative mt-1">
              <input
                id="password-login"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Contraseña"
                className="h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 pr-10 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
              />
              <PasswordVisibilityToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Link
              href={
                emailLocked
                  ? `/forgot-password?autosend=1&email=${encodeURIComponent(emailLocked)}`
                  : '/forgot-password'
              }
              className="text-sm text-[#3b82f6] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <button
            type="submit"
            disabled={disabled}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Spinner />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      )}

      {mailUi === 'password_signup' && (
        <form onSubmit={handleSignupSubmit} className="mt-4 space-y-4">
          <h1 className="mb-6 text-center text-[26px] font-bold leading-tight text-white sm:text-[28px]">
            Define la contraseña para tu cuenta
          </h1>
          <div>
            <label htmlFor="locked-email-signup" className="sr-only">
              Correo electrónico
            </label>
            <input
              id="locked-email-signup"
              type="email"
              value={emailLocked}
              readOnly
              tabIndex={-1}
              className="h-11 w-full cursor-default rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e]/80 px-3 text-sm text-[#aeaeb2] outline-none"
            />
          </div>
          <div>
            <label htmlFor="password-signup" className="sr-only">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password-signup"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Contraseña"
                className="h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 pr-10 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
              />
              <PasswordVisibilityToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
            <PasswordRequirementsList password={password} showWhenEmpty />
          </div>
          <div className="flex gap-3 pt-1">
            <input
              id="acceptLegalSignup"
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#5c5c5e] bg-[#2c2c2e] text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-0"
            />
            <label htmlFor="acceptLegalSignup" className="text-[13px] leading-snug text-[#aeaeb2]">
              He leído y acepto la{' '}
              <Link
                href="/privacidad"
                className="text-[#3b82f6] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Política de protección de datos
              </Link>{' '}
              y los{' '}
              <Link href="/terminos" className="text-[#3b82f6] hover:underline" onClick={(e) => e.stopPropagation()}>
                Términos y condiciones
              </Link>
              .
            </label>
          </div>
          <button
            type="submit"
            disabled={disabled || !signupFormValid}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Spinner />}
            {loading ? 'Creando cuenta...' : 'Continuar'}
          </button>
        </form>
      )}

      {mailUi === 'button' && <AuthLegalFooter />}
        </>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 text-[#8e8e93]">Cargando…</div>}>
      <LoginPageInner />
    </Suspense>
  )
}
