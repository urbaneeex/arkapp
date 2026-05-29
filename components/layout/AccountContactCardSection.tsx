'use client'

import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ChevronDown, ChevronRight, IdCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccountMenuUser } from '@/components/layout/AccountMenuActions'
import {
  getStaffContactCardAbsoluteUrl,
  resolveStaffContactCardPath,
} from '@/lib/staff/staffContactCard'

export function AccountContactCardSection({
  user,
  variant = 'popover',
  onOpenFullView,
}: {
  user: AccountMenuUser
  variant?: 'popover' | 'sheet'
  onOpenFullView?: () => void
}) {
  const vcfPath = resolveStaffContactCardPath(user)
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const vcfUrl = useMemo(() => {
    if (!vcfPath) return null
    return getStaffContactCardAbsoluteUrl(vcfPath, origin || undefined)
  }, [origin, vcfPath])

  if (!vcfPath || !vcfUrl) return null

  const rowClass =
    variant === 'sheet'
      ? 'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm text-zinc-100 transition-colors hover:bg-zinc-800/80'
      : 'flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'

  if (variant === 'sheet') {
    return (
      <button type="button" onClick={onOpenFullView} className={rowClass}>
        <span className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-zinc-400" aria-hidden />
          Mi tarjeta
        </span>
        <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden />
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={rowClass}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-zinc-400" aria-hidden />
          Mi tarjeta
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mx-4 mb-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <p className="mb-3 text-center text-xs text-zinc-500">Escanea para guardar el contacto</p>
          <div className="flex justify-center">
            <div className="rounded-lg border border-zinc-700 bg-white p-3 shadow-lg">
              {origin ? (
                <QRCodeSVG value={vcfUrl} size={140} level="M" />
              ) : (
                <div className="h-[140px] w-[140px] animate-pulse rounded bg-zinc-200" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
