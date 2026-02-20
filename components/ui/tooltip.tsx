'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const SIDE_OFFSET = 20

interface TooltipProps {
  content: string
  children: React.ReactElement
  side?: 'right' | 'left'
  sideOffset?: number
  className?: string
}

export function Tooltip({
  content,
  children,
  side = 'right',
  sideOffset = SIDE_OFFSET,
  className,
}: TooltipProps) {
  const [visible, setVisible] = React.useState(false)
  const [entered, setEntered] = React.useState(false)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showDelay = 80

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
      setVisible(true)
      setEntered(false)
    }, showDelay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
    setEntered(false)
  }

  React.useEffect(() => {
    if (!visible || !rect) return
    const id = requestAnimationFrame(() => {
      setEntered(true)
    })
    return () => cancelAnimationFrame(id)
  }, [visible, rect])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const tooltipEl =
    visible &&
    typeof document !== 'undefined' &&
    rect && (
      <span
        role="tooltip"
        className="fixed z-[9999] inline-flex items-center"
        style={{
          left: side === 'right' ? rect.right + sideOffset : undefined,
          right: side === 'left' ? window.innerWidth - rect.left + sideOffset : undefined,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
        }}
      >
        {/* Bubble único: caret como ::before (misma animación, punta redondeada) */}
        <span
          className={cn(
            'relative inline-flex items-center rounded-xl bg-white text-zinc-950 font-medium text-sm whitespace-nowrap',
            'shadow-lg px-4 py-2',
            'transition-all duration-200 ease-out',
            'before:content-[""] before:block before:absolute before:top-1/2 before:right-full before:-translate-y-1/2',
            'before:w-2 before:h-2 before:rotate-45 before:bg-white before:rounded-[2px] before:-mr-1',
            entered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-[3px]'
          )}
        >
          {content}
        </span>
      </span>
    )

  return (
    <div
      ref={triggerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {typeof document !== 'undefined' && tooltipEl && createPortal(tooltipEl, document.body)}
    </div>
  )
}
