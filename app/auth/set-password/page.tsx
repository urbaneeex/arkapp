'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'

/**
 * Página para que un usuario ya logueado cambie su contraseña.
 * Las invitaciones de empleados se gestionan en /auth/accept-invite con tokens personalizados.
 */
export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [hasUser, setHasUser] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasUser(!!user)
      setChecking(false)
      if (!user) {
        router.replace('/login?redirect=/auth/set-password')
      }
    })
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
      setLoading(false)
    }
  }

  if (checking || !hasUser) {
    return (
      <AuthShell>
        <div className="auth-card text-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-4" />
          <p className="text-[#f1f0ec]/55">Comprobando sesión...</p>
        </div>
    </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <h1 className="auth-title mb-3">Cambiar contraseña</h1>
        <p className="mb-8 text-[15px] text-[#f1f0ec]/55">
          Introduce tu nueva contraseña.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="auth-label">Nueva contraseña *</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              className="auth-input"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="auth-label">Repetir contraseña *</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar contraseña'
            )}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#f1f0ec]/55">
          <Link href="/dashboard" className="auth-link">
            Volver al panel
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
