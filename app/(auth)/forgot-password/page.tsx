'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { AuthCheckEmailPanel } from '@/components/auth/auth-check-email-panel'

const STORAGE_SENT_EMAIL = 'pwd_reset_sent_email'
const STORAGE_AUTOSEND_INFLIGHT = 'pwd_reset_autosend_inflight'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

function looksLikeEmail(s: string) {
  const t = normalizeEmail(s)
  return t.includes('@') && t.length > 4
}

async function postRequestReset(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    })
    return res.ok
  } catch {
    return false
  }
}

function ForgotPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<'form' | 'sent'>('form')
  const [email, setEmail] = useState('')
  const [displayEmail, setDisplayEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sentParam = searchParams.get('sent') === '1'
  const emailFromQuery = normalizeEmail(searchParams.get('email') ?? '')
  const autosendParam =
    searchParams.get('autosend') === '1' && looksLikeEmail(emailFromQuery)
  /** Mientras ?autosend=1 sigue en la URL y aún no estamos en “sent”, mostrar envío (sin flash de formulario) */
  const showAutosendPending = autosendParam && phase !== 'sent' && !sentParam
  /** ?sent=1: hasta leer sessionStorage y fijar fase “sent” (evita un frame del formulario) */
  const showSentHydrating = sentParam && phase !== 'sent'

  /** Vista ?sent=1: restaurar email desde sessionStorage (diferido para ESLint) */
  useEffect(() => {
    if (!sentParam) return
    queueMicrotask(() => {
      const stored = sessionStorage.getItem(STORAGE_SENT_EMAIL)
      if (stored && looksLikeEmail(stored)) {
        setDisplayEmail(normalizeEmail(stored))
        setPhase('sent')
      } else {
        router.replace('/forgot-password')
      }
    })
  }, [sentParam, router])

  /** Prefill ?email= sin autosend */
  useEffect(() => {
    if (searchParams.get('sent') === '1' || searchParams.get('autosend') === '1') return
    const raw = searchParams.get('email')
    if (!raw || !looksLikeEmail(raw)) return
    queueMicrotask(() => setEmail(normalizeEmail(raw)))
  }, [searchParams])

  /** Quitar ?autosend=1 si el email de la URL no es válido */
  useEffect(() => {
    if (searchParams.get('autosend') !== '1') return
    if (looksLikeEmail(emailFromQuery)) return
    router.replace('/forgot-password')
  }, [searchParams, emailFromQuery, router])

  /** Autosend desde login (?autosend=1&email=) */
  useEffect(() => {
    if (sentParam) return
    if (!autosendParam) return

    const emailNorm = emailFromQuery
    const inflight = sessionStorage.getItem(STORAGE_AUTOSEND_INFLIGHT)
    if (inflight === emailNorm) return

    sessionStorage.setItem(STORAGE_AUTOSEND_INFLIGHT, emailNorm)
    queueMicrotask(() => setError(''))

    ;(async () => {
      const ok = await postRequestReset(emailNorm)
      sessionStorage.removeItem(STORAGE_AUTOSEND_INFLIGHT)
      if (ok) {
        sessionStorage.setItem(STORAGE_SENT_EMAIL, emailNorm)
        router.replace('/forgot-password?sent=1')
        setDisplayEmail(emailNorm)
        setPhase('sent')
      } else {
        router.replace(`/forgot-password?email=${encodeURIComponent(emailNorm)}`)
        setEmail(emailNorm)
        setPhase('form')
        setError('No se pudo enviar el correo. Inténtalo de nuevo.')
      }
    })()
  }, [sentParam, autosendParam, emailFromQuery, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const em = normalizeEmail(email)
    if (!looksLikeEmail(em)) {
      setError('Introduce un email válido.')
      return
    }
    setLoading(true)
    setError('')

    const ok = await postRequestReset(em)
    setLoading(false)
    if (ok) {
      sessionStorage.setItem(STORAGE_SENT_EMAIL, em)
      setDisplayEmail(em)
      setPhase('sent')
      router.replace('/forgot-password?sent=1')
    } else {
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
    }
  }

  if (showSentHydrating || showAutosendPending) {
    return (
      <div className="w-full rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Spinner />
          <p className="mt-4 text-[15px] text-[#8e8e93]">
            {showAutosendPending ? 'Enviando enlace a tu correo…' : 'Cargando…'}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'sent') {
    return (
      <div className="w-full rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
        <AuthCheckEmailPanel
          email={displayEmail}
          description="Te hemos enviado un correo con un enlace para crear una nueva contraseña. Si no lo ves, revisa la carpeta de spam."
          back={{ href: '/login' }}
          onResend={async () => {
            const ok = await postRequestReset(displayEmail)
            return ok ? { ok: true } : { ok: false, message: 'No se pudo reenviar. Inténtalo de nuevo.' }
          }}
        />
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[#8e8e93] transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Volver
      </Link>

      <h1 className="font-display mb-2 text-[28px] font-bold text-white">Recuperar contraseña</h1>
      <p className="mb-6 text-[15px] text-[#8e8e93]">Te enviaremos un enlace para cambiar tu contraseña</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}

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
            autoComplete="email"
            className="mt-1 h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 text-white placeholder:text-[#6b6b6d] outline-none focus:border-brand"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Enviando...' : 'Enviar enlace'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#8e8e93]">
        <Link href="/login" className="text-brand hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  )
}

function ForgotPasswordFallback() {
  return (
    <div className="w-full rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner />
        <p className="mt-4 text-sm text-[#8e8e93]">Cargando…</p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordContent />
    </Suspense>
  )
}
