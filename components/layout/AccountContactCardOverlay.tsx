'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Phone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccountMenuUser } from '@/components/layout/AccountMenuActions'
import {
  getStaffContactCardAbsoluteUrl,
  resolveStaffContactCardDetails,
} from '@/lib/staff/staffContactCard'

export function AccountContactCardOverlay({
  user,
  open,
  onClose,
}: {
  user: AccountMenuUser
  open: boolean
  onClose: () => void
}) {
  const card = resolveStaffContactCardDetails(user)
  const [origin, setOrigin] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('contact-card-overlay-open')
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.classList.remove('contact-card-overlay-open')
    }
  }, [open])

  const vcfUrl = useMemo(() => {
    if (!card) return null
    return getStaffContactCardAbsoluteUrl(card.vcfPath, origin || undefined)
  }, [card, origin])

  if (!mounted || !open || !card || !vcfUrl) return null

  const telHref = card.phone.replace(/\s+/g, '')

  return createPortal(
    <div className="fixed inset-0 z-[200] isolate animate-in fade-in duration-200">
      <div
        role="button"
        tabIndex={0}
        className="contact-card-frosted-overlay"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClose()
          }
        }}
        aria-label="Cerrar tarjeta"
      />

      <div className="contact-card-holo-bg" aria-hidden>
        <div className="contact-card-holo-blob contact-card-holo-blob--1" />
        <div className="contact-card-holo-blob contact-card-holo-blob--2" />
        <div className="contact-card-holo-blob contact-card-holo-blob--3" />
        <div className="contact-card-holo-shimmer" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-card-title"
          className={cn(
            'pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-3xl',
            'border border-zinc-700/80 bg-zinc-900 px-6 pb-10 pt-5 shadow-2xl shadow-black/50',
            'animate-in fade-in zoom-in-95 duration-200'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          <div className="flex flex-col items-center pt-6 text-center">
            <p className="font-display text-3xl font-bold tracking-tight">
              <span className="text-brand">Ark</span>
              <span className="text-zinc-100">app</span>
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
              {card.role}
            </p>

            <h2 id="contact-card-title" className="mt-6 font-display text-2xl font-bold text-zinc-100">
              {card.firstName} {card.lastName}
            </h2>

            <a
              href={`tel:${telHref}`}
              className="mt-3 inline-flex items-center gap-2 text-base font-medium text-brand transition-colors hover:text-brand-hover"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {card.phone}
            </a>

            <div className="mt-8 rounded-2xl border border-zinc-700 bg-white p-4 shadow-lg">
              {origin ? (
                <QRCodeSVG value={vcfUrl} size={220} level="M" />
              ) : (
                <div className="h-[220px] w-[220px] animate-pulse rounded bg-zinc-200" />
              )}
            </div>

            <p className="mt-6 max-w-xs text-sm text-zinc-500">
              Escanea el código para guardar el contacto
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
