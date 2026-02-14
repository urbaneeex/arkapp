'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    // Si Supabase devuelve sesión (p. ej. con "Confirm email" desactivado), entramos directo
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    // Si requiere confirmar email: avisar y redirigir a login
    if (data.user && !data.session) {
      setError(
        'Cuenta creada. Revisa tu email para confirmar, o desactiva "Confirm email" en Supabase (Authentication → Providers → Email) para entrar sin confirmar.'
      )
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Crear cuenta</h1>
      <p className="text-gray-600 mb-6">
        Regístrate para gestionar tu negocio
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creando cuenta...' : 'Registrarme'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#2563eb] font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
