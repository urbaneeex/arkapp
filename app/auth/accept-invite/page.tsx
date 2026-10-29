'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'

type InviteInfo = {
  email: string
  staff_id: string
  name: string
}

function AcceptInvitePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const token = searchParams.get('token')

  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Enlace inválido. Falta el token.')
      setVerifying(false)
      return
    }

    let cancelled = false
    fetch(`/api/staff/verify-invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok && !data.email) {
          if (data.error === 'expired' || data.message?.toLowerCase().includes('expirado')) {
            router.replace('/auth/expired')
            return
          }
          if (data.error === 'already_used' || data.message?.toLowerCase().includes('ya fue utilizada')) {
            setError('Esta invitación ya fue utilizada. Si ya tienes cuenta, inicia sesión.')
            setVerifying(false)
            return
          }
          setError(data.message || data.error || 'Enlace inválido.')
          setVerifying(false)
          return
        }
        return data
      })
      .then((data) => {
        if (cancelled || !data) return
        if (data.error === 'expired' || data.message?.toLowerCase().includes('expirado')) {
          router.replace('/auth/expired')
          return
        }
        if (data.error === 'already_used' || data.message?.toLowerCase().includes('ya fue utilizada')) {
          setError('Esta invitación ya fue utilizada. Si ya tienes cuenta, inicia sesión.')
          setVerifying(false)
          return
        }
        if (data.error || !data.email) {
          setError(data.message || data.error || 'Enlace inválido.')
          setVerifying(false)
          return
        }
        setInvite({ email: data.email, staff_id: data.staff_id, name: data.name })
        setVerifying(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('No se pudo verificar el enlace.')
          setVerifying(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!/(?=.*[a-z])/.test(password)) {
      setError('La contraseña debe contener al menos una letra minúscula.')
      return
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      setError('La contraseña debe contener al menos una letra mayúscula.')
      return
    }
    if (!/(?=.*\d)/.test(password)) {
      setError('La contraseña debe contener al menos un número.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al establecer la contraseña.')
        setLoading(false)
        return
      }

      // Cerrar cualquier sesión previa (admin) y crear sesión del empleado
      await supabase.auth.signOut()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite!.email,
        password,
      })

      if (signInError) {
        setError('Cuenta creada pero error al iniciar sesión. Intenta iniciar sesión manualmente.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar.')
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <AuthShell>
        <div className="auth-card text-center">
          <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto mb-4" />
          <p className="text-[#f1f0ec]/55">Verificando invitación...</p>
        </div>
    </AuthShell>
    )
  }

  if (!invite) {
    return (
      <AuthShell>
        <div className="auth-card text-center">
          {error && (
            <div className="flex items-center gap-2 justify-center text-red-300 mb-4">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <Link
            href="/login"
            className="auth-btn"
          >
            Ir al inicio de sesión
          </Link>
        </div>
    </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <h1 className="auth-title mb-3">Establece tu contraseña</h1>
        <p className="mb-8 text-[15px] text-[#f1f0ec]/55">
          Hola {invite.name}. Introduce una contraseña para acceder a tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="auth-label">Email</label>
            <input
              id="email"
              type="email"
              value={invite.email}
              disabled
              className="auth-input opacity-70"
            />
          </div>

          <div>
            <label htmlFor="password" className="auth-label">Contraseña *</label>
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
              'Guardar contraseña e iniciar sesión'
            )}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#f1f0ec]/55">
          <Link href="/login" className="auth-link">
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInvitePageInner />
    </Suspense>
  )
}
