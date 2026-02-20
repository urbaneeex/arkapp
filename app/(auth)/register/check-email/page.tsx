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
    <div className="bg-zinc-900 rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md mx-auto text-center">
      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
        <Mail className="w-7 h-7 text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Revisa tu email</h1>
      <p className="text-zinc-400 mb-6">
        Te hemos enviado un correo de confirmación. Haz clic en el enlace del email para activar tu cuenta.
      </p>
      <p className="text-sm text-zinc-400">
        Esta pestaña se actualizará automáticamente cuando confirmes tu email.
      </p>
    </div>
  )
}
