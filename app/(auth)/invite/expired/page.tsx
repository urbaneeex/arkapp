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
    <div className="auth-card">
      <p className="text-[#f1f0ec]/55">Redirigiendo...</p>
    </div>
  )
}
