'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  AccountMenuActions,
  AccountMenuLogoutButton,
  AccountMenuUserHeader,
  type AccountMenuUser,
} from '@/components/layout/AccountMenuActions'
import { AccountContactCardOverlay } from '@/components/layout/AccountContactCardOverlay'
import { resolveStaffContactCardPath } from '@/lib/staff/staffContactCard'
import {
  MOBILE_OVERFLOW_NAV_ITEMS,
  hrefWithStackAccount,
} from '@/lib/app-shell/mobileOverflowNav'

export function AppAccountPanel({ user }: { user: AccountMenuUser }) {
  const router = useRouter()
  const { hasPermission, loading, isOwner } = usePermissions()
  const hasContactCard = useMemo(() => Boolean(resolveStaffContactCardPath(user)), [user])
  const [showContactCard, setShowContactCard] = useState(false)

  const visibleOverflow = useMemo(() => {
    if (loading) return MOBILE_OVERFLOW_NAV_ITEMS.filter((i) => !i.requireOwner)
    return MOBILE_OVERFLOW_NAV_ITEMS.filter((item) => {
      if (item.requireOwner && !isOwner) return false
      return !item.permission || hasPermission(item.permission)
    })
  }, [hasPermission, loading, isOwner])

  const openSection = (href: string) => {
    router.push(hrefWithStackAccount(href))
  }

  return (
    <>
      <div className="mx-auto w-full max-w-lg lg:max-w-2xl">
      <PageHeader title="Cuenta" />

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
        <AccountMenuUserHeader user={user} compact showEditButton />
        <AccountMenuActions
          user={user}
          variant="sheet"
          hideProfileLink
          hideLogout
          onContactCardOpen={() => setShowContactCard(true)}
        />
      </div>

      <p className="mb-2 mt-6 px-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Más secciones
      </p>

      <ul className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 px-2 py-1">
        {visibleOverflow.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">
            No hay más secciones disponibles.
          </li>
        ) : (
          visibleOverflow.map((item) => {
            const { href, label, icon: Icon } = item

            return (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => openSection(href)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800/80 active:bg-zinc-800'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                  {label}
                </button>
              </li>
            )
          })
        )}
      </ul>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 px-2 py-1">
        <AccountMenuLogoutButton variant="sheet" />
      </div>
      </div>

      {hasContactCard ? (
        <AccountContactCardOverlay
          user={user}
          open={showContactCard}
          onClose={() => setShowContactCard(false)}
        />
      ) : null}
    </>
  )
}
