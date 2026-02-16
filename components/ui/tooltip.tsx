'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: React.ReactElement
  side?: 'right' | 'left'
  className?: string
}

export function Tooltip({ content, children, side = 'right', className }: TooltipProps) {
  const [visible, setVisible] = React.useState(false)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showDelay = 80
  const gap = 6

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
      setVisible(true)
    }, showDelay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }

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
        className={cn(
          'fixed z-[9999] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap',
          'transition-opacity duration-100'
        )}
        style={
          side === 'right'
            ? {
                left: rect.right + gap,
                top: rect.top + rect.height / 2,
                transform: 'translateY(-50%)',
              }
            : {
                right: window.innerWidth - rect.left + gap,
                top: rect.top + rect.height / 2,
                transform: 'translateY(-50%)',
              }
        }
      >
        {/* Cola del bocadillo a la izquierda (apunta al icono) */}
        <span
          className="absolute top-1/2 w-0 h-0 border-[5px] border-transparent -translate-y-1/2"
          style={{
            right: '100%',
            borderRightColor: 'rgb(17 24 39)',
            marginRight: '-1px',
          }}
          aria-hidden
        />
        {content}
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
