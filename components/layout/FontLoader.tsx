'use client'

import { useEffect } from 'react'

/**
 * Carga Clash Display de forma NO bloqueante después de la hidratación.
 * Evita que la fuente de terceros retrase el FCP.
 */
export function FontLoader() {
  useEffect(() => {
    if (document.querySelector('link[data-clash-display]')) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.dataset.clashDisplay = 'true'
    link.href = 'https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap'
    document.head.appendChild(link)
  }, [])
  return null
}
