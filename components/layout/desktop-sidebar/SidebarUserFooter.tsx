'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  AccountMenuActions,
  AccountMenuUserHeader,
  type AccountMenuUser,
} from '@/components/layout/AccountMenuActions'
import { useAppTabShellOptional } from '@/components/app-shell/AppTabShellProvider'

export function SidebarUserFooter({ user }: { user: AccountMenuUser }) {
  const [open, setOpen] = useState(false)
  const shell = useAppTabShellOptional()
  const displayName = user.name || user.email?.split('@')[0] || 'Usuario'

  return (
    <div className="shrink-0 border-t border-zinc-800 p-3">
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
              'hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              open && 'bg-zinc-800/50'
            )}
            aria-label="Abrir menú de usuario"
          >
            <Avatar name={displayName} size="sm" className="h-8 w-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{displayName}</span>
            <MoreHorizontal className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="z-[300] w-72 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-0 shadow-2xl"
        >
          <AccountMenuUserHeader user={user} businessName={shell?.businessName} compact />
          <AccountMenuActions onAction={() => setOpen(false)} variant="popover" />
        </PopoverContent>
      </Popover>
    </div>
  )
}
