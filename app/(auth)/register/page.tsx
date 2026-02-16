'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, X } from 'lucide-react'

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    owner_name: '',
    owner_phone: '',
    business_name: '',
    slug: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugExists, setSlugExists] = useState<boolean | null>(null)

  const updateForm = useCallback((updates: Partial<typeof form>) => {
    setForm((prev) => {
      const next = { ...prev, ...updates }
      if ('business_name' in updates && !slugTouched) {
        next.slug = generateSlug(next.business_name)
      }
      return next
    })
  }, [slugTouched])

  const checkSlugUniqueness = useCallback(async (slug: string) => {
    if (!slug || !SLUG_REGEX.test(slug)) {
      setSlugExists(null)
      return
    }
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    setSlugExists(!!data)
  }, [])

  const handleSlugChange = (value: string) => {
    setSlugTouched(true)
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    updateForm({ slug: normalized })
    if (normalized) {
      checkSlugUniqueness(normalized)
    } else {
      setSlugExists(null)
    }
  }

  const passwordsMatch = form.password === form.confirmPassword
  const passwordsMatchTouched = form.confirmPassword.length > 0
  const slugValid = form.slug.length > 0 && SLUG_REGEX.test(form.slug)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!slugValid) {
      setError('La URL del negocio no es válida (solo letras, números y guiones)')
      return
    }
    if (slugExists === true) {
      setError('Este nombre de negocio ya está en uso')
      return
    }

    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          setError('Este email ya está registrado')
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('No se pudo crear la cuenta. Inténtalo de nuevo.')
        setLoading(false)
        return
      }

      const { error: businessError } = await supabase.from('businesses').insert({
        owner_uid: authData.user.id,
        owner_name: form.owner_name.trim(),
        owner_phone: form.owner_phone.trim(),
        business_name: form.business_name.trim(),
        name: form.business_name.trim(),
        slug: form.slug.trim(),
        onboarding_completed: true,
        currency: 'EUR',
        timezone: 'Europe/Madrid',
      })

      if (businessError) {
        if (businessError.code === '23505') {
          setError('Este nombre de negocio ya está en uso')
        } else {
          setError(businessError.message)
        }
        setLoading(false)
        return
      }

      if (authData.session) {
        router.push('/dashboard')
        router.refresh()
        return
      }
      setError(
        'Cuenta creada. Revisa tu email para confirmar, o desactiva "Confirm email" en Supabase para entrar sin confirmar.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Crear cuenta</h1>
      <p className="text-gray-600 mb-6">
        Completa los datos y empieza a gestionar tu negocio
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="owner_name">Tu nombre completo</Label>
          <Input
            id="owner_name"
            type="text"
            value={form.owner_name}
            onChange={(e) => updateForm({ owner_name: e.target.value })}
            placeholder="Juan Pérez"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="owner_phone">Tu teléfono</Label>
          <Input
            id="owner_phone"
            type="tel"
            value={form.owner_phone}
            onChange={(e) => updateForm({ owner_phone: e.target.value })}
            placeholder="+34 612 34 56 78"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="business_name">Nombre de tu negocio</Label>
          <Input
            id="business_name"
            type="text"
            value={form.business_name}
            onChange={(e) => {
              const v = e.target.value
              updateForm({ business_name: v })
              if (!slugTouched) {
                const newSlug = generateSlug(v)
                if (newSlug) checkSlugUniqueness(newSlug)
                else setSlugExists(null)
              }
            }}
            placeholder="Mi Empresa"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="slug">URL de tu negocio</Label>
          <Input
            id="slug"
            type="text"
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="mi-empresa"
            required
            className="mt-1 font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            tuapp.com/book/{form.slug || 'tu-slug'}
          </p>
          {form.slug.length > 0 && !SLUG_REGEX.test(form.slug) && (
            <p className="mt-1 text-xs text-amber-600">
              Solo letras minúsculas, números y guiones
            </p>
          )}
          {slugExists === true && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Este nombre ya está en uso
            </p>
          )}
          {slugExists === false && slugValid && (
            <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> URL disponible
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateForm({ email: e.target.value })}
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
            value={form.password}
            onChange={(e) => updateForm({ password: e.target.value })}
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <div className="relative mt-1">
            <Input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateForm({ confirmPassword: e.target.value })}
              placeholder="Repite tu contraseña"
              required
              className="pr-9"
            />
            {passwordsMatchTouched && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {passwordsMatch ? (
                  <Check className="w-5 h-5 text-emerald-600" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
              </span>
            )}
          </div>
          {passwordsMatchTouched && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={loading || slugExists === true || !passwordsMatch}
        >
          {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#2563eb] font-medium hover:underline cursor-pointer">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
