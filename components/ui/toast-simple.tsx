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
        'fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-xl text-sm font-medium text-white animate-in fade-in slide-in-from-top-4',
        type === 'success' && 'bg-emerald-600',
        type === 'error' && 'bg-red-600'
      )}
      role="status"
    >
      {message}
    </div>
  )
}
