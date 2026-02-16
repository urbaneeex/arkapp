'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format, addDays, subDays, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DateNavigator({
  value,
  onChange,
  minDate,
  className,
}: {
  value: string // yyyy-MM-dd
  onChange: (date: string) => void
  minDate?: Date
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const date = new Date(value + 'T12:00:00')
  const isMinDate = minDate && (isToday(date) || date <= minDate)
  const minDateStr = minDate ? format(minDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

  const openNativePicker = () => {
    if (typeof document === 'undefined') return
    const input = inputRef.current
    if (!input) return
    input.click()
    if ('showPicker' in HTMLInputElement.prototype) {
      ;(input as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    }
  }

  const goPrev = () => {
    const prev = subDays(date, 1)
    if (minDate && prev < minDate) return
    onChange(format(prev, 'yyyy-MM-dd'))
  }

  const goNext = () => {
    onChange(format(addDays(date, 1), 'yyyy-MM-dd'))
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <label className="text-sm font-medium text-gray-700">Fecha</label>
      </div>
      <div className="flex items-center gap-2 relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goPrev}
          disabled={isMinDate}
          className="h-10 w-10 flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={openNativePicker}
          className="flex-1 h-10 px-4 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 cursor-pointer transition-colors"
        >
          {format(date, "d 'de' MMMM yyyy", { locale: es })}
        </button>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={minDateStr}
          className="absolute w-0 h-0 opacity-0 pointer-events-none"
          aria-hidden
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goNext}
          className="h-10 w-10 flex-shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
