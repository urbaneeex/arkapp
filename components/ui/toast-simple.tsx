'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export function ToastSimple({
  message,
  type,
  onDismiss,
  duration = 3000,
}: {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
  duration?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [duration, onDismiss])

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white',
        type === 'success' && 'bg-emerald-600',
        type === 'error' && 'bg-red-600'
      )}
      role="status"
    >
      {message}
    </div>
  )
}
