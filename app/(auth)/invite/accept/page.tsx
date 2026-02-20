'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Redirige a la página única de aceptar invitación.
 * Mantener esta ruta por compatibilidad con enlaces antiguos.
 */
export default function InviteAcceptRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('code')
    const url = token
      ? `/auth/accept-invite?token=${encodeURIComponent(token)}`
      : '/auth/accept-invite'
    router.replace(url)
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <p className="text-zinc-400">Redirigiendo...</p>
    </div>
  )
}
