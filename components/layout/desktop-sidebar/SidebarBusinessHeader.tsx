'use client'

import { ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { useBusinessStore } from '@/stores/business'
import { useAppTabShellOptional } from '@/components/app-shell/AppTabShellProvider'

export function SidebarBusinessHeader() {
  const business = useBusinessStore((s) => s.business)
  const shell = useAppTabShellOptional()
  const name = business?.name?.trim() || shell?.businessName?.trim() || 'Mi empresa'
  const plan = business?.plan?.trim()

  return (
    <button
      type="button"
      className={cn(
        'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
        'hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
      )}
      aria-label={`Empresa: ${name}`}
    >
      {business?.logo_url ? (
        <img
          src={business.logo_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-zinc-700 object-cover"
        />
      ) : (
        <Avatar name={name} size="sm" className="h-8 w-8 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-100">{name}</span>
        {plan ? (
          <span className="mt-0.5 inline-flex rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {plan}
          </span>
        ) : null}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
    </button>
  )
}
