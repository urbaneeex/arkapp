'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'

export default function CheckEmailPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/dashboard')
        router.refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="auth-card">
      <Mail className="mb-6 h-8 w-8 text-brand" strokeWidth={1.5} aria-hidden />
      <h1 className="auth-title mb-4">Revisa tu email</h1>
      <p className="text-[#f1f0ec]/55 mb-6">
        Te hemos enviado un correo de confirmación. Haz clic en el enlace del email para activar tu cuenta.
      </p>
      <p className="text-sm text-[#f1f0ec]/55">
        Esta pestaña se actualizará automáticamente cuando confirmes tu email.
      </p>
    </div>
  )
}
