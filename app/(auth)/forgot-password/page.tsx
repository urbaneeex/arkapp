'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToastFeedback } from '@/hooks/use-toast-feedback'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const inCooldown = Date.now() < cooldownUntil
  const disabled = loading || inCooldown
  useToastFeedback({ error, success })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError('Ha ocurrido un error. Inténtalo de nuevo.')
        setCooldownUntil(Date.now() + 3000)
        return
      }
      if (data?.message) {
        setSuccess(data.message)
      } else {
        setSuccess('Si ese email está registrado, recibirás un enlace en breve')
      }
    } catch {
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
      setCooldownUntil(Date.now() + 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      <h1 className="mb-2 text-[28px] font-bold text-white">Recuperar contraseña</h1>
      <p className="mb-6 text-[15px] text-[#8e8e93]">Te enviaremos un enlace para cambiar tu contraseña</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{success}</div>}

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

        <button
          type="submit"
          disabled={disabled}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Enviando...' : inCooldown ? 'Espera 3 segundos...' : 'Enviar enlace'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#8e8e93]">
        <Link href="/login" className="text-[#3b82f6] hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  )
}
