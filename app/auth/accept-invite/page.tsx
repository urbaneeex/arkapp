'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

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
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="bg-zinc-900 rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Verificando invitación...</p>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="bg-zinc-900 rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          {error && (
            <div className="flex items-center gap-2 justify-center text-red-600 mb-4">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="bg-zinc-900 rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold mb-1">
          <Lock className="h-5 w-5 text-blue-600" />
          Establece tu contraseña
        </div>
        <p className="text-zinc-400 text-sm mb-6">
          Hola {invite.name}. Introduce una contraseña para acceder a tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={invite.email}
              disabled
              className="bg-zinc-950 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">Contraseña *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Repetir contraseña *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              className="mt-1"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar contraseña e iniciar sesión'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-400 mt-4">
          <Link href="/login" className="text-blue-600 hover:underline">
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInvitePageInner />
    </Suspense>
  )
}
