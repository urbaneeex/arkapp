'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar } from '@/components/ui/avatar'
import {
  AccountMenuActions,
  AccountMenuUserHeader,
  type AccountMenuUser,
} from '@/components/layout/AccountMenuActions'

type UserMenuProps = {
  user: AccountMenuUser
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const displayName = user.name || user.email?.split('@')[0] || 'Usuario'

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white transition-shadow hover:ring-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-white dark:ring-offset-zinc-950 dark:focus:ring-offset-zinc-950"
          aria-label="Abrir menú de usuario"
        >
          <Avatar name={displayName} size="md" className="h-10 w-10 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={{ top: 72, right: 16, bottom: 16, left: 16 }}
        className="z-[300] w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl shadow-black/20 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40"
      >
        <AccountMenuUserHeader user={user} />
        <AccountMenuActions user={user} onAction={() => setOpen(false)} variant="popover" />
      </PopoverContent>
    </Popover>
  )
}
