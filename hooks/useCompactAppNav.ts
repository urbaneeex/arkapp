'use client'

import { useEffect, useState } from 'react'

/** Móvil + tablet: bottom nav visible (< lg). */
export function useCompactAppNav() {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return compact
}
