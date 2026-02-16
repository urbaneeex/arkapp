'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { minutesToTime, timeToMinutes } from '@/lib/availability'

type Slot = { start_min: number; end_min: number; label: string; occupied: boolean }

export function TimeNavigator({
  value,
  onChange,
  availableSlots,
  disabled,
  className,
}: {
  value: string // HH:mm
  onChange: (time: string) => void
  availableSlots: Slot[]
  disabled?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const currentMin = value ? timeToMinutes(value) : null
  const availableOnly = availableSlots.filter((s) => !s.occupied)
  const currentIndex = currentMin != null ? availableOnly.findIndex((s) => s.start_min === currentMin) : -1
  // Las flechas funcionan siempre que haya slots disponibles
  // Si la hora actual no coincide exactamente, permitir navegar al primero/último slot
  const canGoPrev = availableOnly.length > 0 && (currentIndex > 0 || currentIndex === -1)
  const canGoNext = availableOnly.length > 0 && (currentIndex < availableOnly.length - 1 || currentIndex === -1)

  const openNativePicker = () => {
    if (disabled) return
    if (typeof document === 'undefined') return
    const input = inputRef.current
    if (!input) return
    input.click()
    if ('showPicker' in HTMLInputElement.prototype) {
      ;(input as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    }
  }

  const goPrev = () => {
    if (!canGoPrev || availableOnly.length === 0) return
    if (currentIndex < 0) {
      const lastSlot = availableOnly[availableOnly.length - 1]
      onChange(minutesToTime(lastSlot.start_min))
      return
    }
    const prevSlot = availableOnly[currentIndex - 1]
    onChange(minutesToTime(prevSlot.start_min))
  }

  const goNext = () => {
    if (!canGoNext || availableOnly.length === 0) return
    if (currentIndex < 0) {
      const firstSlot = availableOnly[0]
      onChange(minutesToTime(firstSlot.start_min))
      return
    }
    const nextSlot = availableOnly[currentIndex + 1]
    onChange(minutesToTime(nextSlot.start_min))
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-500" />
        <label className="text-sm font-medium text-gray-700">Hora inicio</label>
      </div>
      <div className="flex items-center gap-2 relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goPrev}
          disabled={disabled || !canGoPrev}
          className="h-10 w-10 flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={openNativePicker}
          disabled={disabled}
          className={cn(
            'flex-1 h-10 px-4 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {value || '--:--'}
        </button>
        <input
          ref={inputRef}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step="60"
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          aria-hidden
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goNext}
          disabled={disabled || !canGoNext}
          className="h-10 w-10 flex-shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
