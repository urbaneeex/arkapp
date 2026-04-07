'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getBusinessForUserClient } from '@/lib/supabase/business-client'
import { UserMenu } from '@/components/layout/UserMenu'
import { ClockStatusButton } from '@/components/layout/ClockStatusButton'
import { cn } from '@/lib/utils'

export function GlobalHeader() {
  const [user, setUser] = useState<{
    email: string
    name?: string
  } | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) return
      setUser({
        email: authUser.email || '',
        name:
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name,
      })
      const business = await getBusinessForUserClient(authUser.id)
      setBusinessName(business?.name ?? null)
    }
    load()
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 z-50 h-16',
        'bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800',
        'flex items-center justify-between',
        'px-4 lg:pl-4 lg:pr-6'
      )}
    >
      {/* Izquierda: logo "Arkapp x [Nombre del Negocio]" */}
      <Link
        href="/dashboard/calendar"
        className="cursor-pointer flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 rounded"
      >
        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Arkapp
          {businessName ? (
            <span className="font-normal"> x {businessName}</span>
          ) : null}
        </span>
      </Link>

      {/* Derecha: botón fichaje + avatar → menú usuario */}
      <div className="flex items-center gap-3">
        {user && <ClockStatusButton />}
        {user ? (
          <UserMenu user={user} />
        ) : (
          <div className="h-10 w-10 rounded-full bg-zinc-800 animate-pulse" />
        )}
      </div>
    </header>
  )
}
