'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToastFeedback } from '@/hooks/use-toast-feedback'

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

function isValidPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const inCooldown = Date.now() < cooldownUntil
  const disabled = loading || inCooldown
  useToastFeedback({ error, success })

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!isValidPassword(password)) {
      setError('La contraseña no cumple los requisitos mínimos')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(mapAuthError(updateError))
      setPassword('')
      setConfirmPassword('')
      setCooldownUntil(Date.now() + 3000)
      return
    }

    setSuccess('Contraseña actualizada correctamente. Redirigiendo...')
    setTimeout(() => {
      router.push('/login?success=password_updated')
    }, 1200)
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-[#1c1c1e] p-8 shadow-lg">
      <h1 className="mb-2 text-[28px] font-bold text-white">Nueva contraseña</h1>
      <p className="mb-6 text-[15px] text-[#8e8e93]">Introduce tu nueva contraseña para continuar</p>

      {!recoveryReady && (
        <div className="mb-4 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
          Validando enlace de recuperación...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{success}</div>}

        <div>
          <label htmlFor="password" className="text-sm text-[#aeaeb2]">
            Nueva contraseña
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

        <div>
          <label htmlFor="confirmPassword" className="text-sm text-[#aeaeb2]">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="mt-1 h-11 w-full rounded-[10px] border border-[#3a3a3c] bg-[#2c2c2e] px-3 text-white placeholder:text-[#6b6b6d] outline-none focus:border-[#3b82f6]"
          />
        </div>

        <ul className="space-y-1 text-xs">
          <li className={password.length >= 8 ? 'text-emerald-400' : 'text-[#8e8e93]'}>• Mínimo 8 caracteres</li>
          <li className={/[A-Z]/.test(password) ? 'text-emerald-400' : 'text-[#8e8e93]'}>• Al menos 1 mayúscula</li>
          <li className={/\d/.test(password) ? 'text-emerald-400' : 'text-[#8e8e93]'}>• Al menos 1 número</li>
        </ul>

        <button
          type="submit"
          disabled={disabled || !recoveryReady}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3b82f6] text-sm font-medium text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Actualizando...' : inCooldown ? 'Espera 3 segundos...' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}
