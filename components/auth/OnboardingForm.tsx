'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PhoneInput } from '@/components/ui/phone-input'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function generateSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base || 'negocio'}-${suffix}`
}

export function OnboardingForm({
  userId,
  defaultName,
}: {
  userId: string
  defaultName: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState(defaultName)
  const [ownerPhone, setOwnerPhone] = useState('')
  const [phoneValid, setPhoneValid] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!businessName.trim()) { setError('El nombre del negocio es obligatorio'); return }
    if (!ownerName.trim()) { setError('Tu nombre es obligatorio'); return }
    const phoneDigits = ownerPhone.replace(/\D/g, '')
    if (!phoneDigits.length) { setError('El teléfono es obligatorio'); return }
    if (!phoneValid) { setError('Revisa el formato del teléfono.'); return }

    setLoading(true)
    const slug = generateSlug(businessName)

    const { error: insertError } = await supabase.from('businesses').insert({
      name: businessName.trim(),
      owner_uid: userId,
      slug,
      owner_name: ownerName.trim(),
      owner_phone: ownerPhone.replace(/\s/g, '').trim(),
      onboarding_completed: true,
    })

    if (insertError) {
      setError('Ha ocurrido un error. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div className="w-full auth-card">
      <h1 className="auth-title mb-3">Configura tu negocio</h1>
      <p className="mb-6 text-[15px] text-[#f1f0ec]/55">Un último paso antes de entrar a tu panel</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}

        <div>
          <label htmlFor="businessName" className="auth-label">
            Nombre de tu negocio
          </label>
          <input
            id="businessName"
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Ej. Peluquería Carmen"
            className="auth-input"
          />
        </div>

        <div>
          <label htmlFor="ownerName" className="auth-label">
            Tu nombre
          </label>
          <input
            id="ownerName"
            type="text"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Tu nombre completo"
            className="auth-input"
          />
        </div>

        <PhoneInput
          id="ownerPhone"
          label="Teléfono de contacto"
          required
          value={ownerPhone}
          defaultCountry="ES"
          onChange={setOwnerPhone}
          onValidationChange={setPhoneValid}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="auth-btn"
          >
            {loading && <Spinner />}
            {loading ? 'Creando...' : 'Entrar a mi panel'}
          </button>
        </div>
      </form>
    </div>
  )
}
