'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function InviteAcceptRedirect() {
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
    <div className="auth-card">
      <p className="text-[#f1f0ec]/55">Redirigiendo...</p>
    </div>
  )
}

export default function InviteAcceptRedirectPage() {
  return (
    <Suspense>
      <InviteAcceptRedirect />
    </Suspense>
  )
}
