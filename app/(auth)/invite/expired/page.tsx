'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirige a la página única de enlace expirado.
 */
export default function InviteExpiredRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/auth/expired')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <p className="text-zinc-400">Redirigiendo...</p>
    </div>
  )
}
