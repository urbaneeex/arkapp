'use client'

import { useState, useEffect, type ReactNode } from 'react'

/**
 * Renders children only after mount. Use to avoid hydration mismatch with
 * @dnd-kit (aria-describedby IDs differ between server and client).
 */
export function ClientOnlyDnd({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <>{fallback}</>
  return <>{children}</>
}
