'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Home,
  LayoutGrid,
  CirclePlus,
  Clock,
  UserCircle,
  CalendarDays,
  Users,
  Briefcase,
  Contact,
  DollarSign,
  Settings,
  ChartColumnIncreasing,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/lib/permissions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AccountMenuActions,
  AccountMenuUserHeader,
  type AccountMenuUser,
} from '@/components/layout/AccountMenuActions'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { WORK_BOARD_NEW_TASK_PARAMS } from '@/lib/app-shell/appTabRoutes'

const overflowMenuItems: {
  href: string
  label: string
  icon: typeof Home
  permission?: PermissionKey
  requireOwner?: boolean
  shellAgenda?: boolean
}[] = [
  {
    href: '/dashboard/work-board?view=calendar&period=week',
    label: 'Agenda',
    icon: CalendarDays,
    permission: 'work_board_view',
    shellAgenda: true,
  },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users, permission: 'clients_view' },
  { href: '/dashboard/services', label: 'Servicios', icon: Briefcase, permission: 'services_view' },
  { href: '/dashboard/staff', label: 'Equipo', icon: Contact, permission: 'staff_view' },
  {
    href: '/dashboard/work-board/productividad',
    label: 'Productividad',
    icon: ChartColumnIncreasing,
    permission: 'tasks_metrics_view',
    requireOwner: true,
  },
  { href: '/dashboard/finances', label: 'Finanzas', icon: DollarSign, permission: 'finances_view' },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings, permission: 'settings_manage' },
]

type PrimaryKey = 'dashboard' | 'workBoard' | 'newTask' | 'fichar'

const primaryBar: {
  key: PrimaryKey
  tab: 'home' | 'workBoard' | 'fichar'
  label: string
  icon: typeof Home
  permission?: PermissionKey
  newTask?: boolean
}[] = [
  { key: 'dashboard', tab: 'home', label: 'Inicio', icon: Home },
  {
    key: 'workBoard',
    tab: 'workBoard',
    label: 'Tablero',
    icon: LayoutGrid,
    permission: 'work_board_view',
  },
  {
    key: 'newTask',
    tab: 'workBoard',
    label: 'Tarea',
    icon: CirclePlus,
    permission: 'work_board_view',
    newTask: true,
  },
  { key: 'fichar', tab: 'fichar', label: 'Fichar', icon: Clock },
]

function pathMatches(pathname: string, path: string) {
  return pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
}

export function MobileBottomNav({
  initialUserName = '',
  initialUserEmail = '',
  initialBusinessName = '',
}: {
  initialUserName?: string
  initialUserEmail?: string
  initialBusinessName?: string
}) {
  const router = useRouter()
  const accountUser: AccountMenuUser | null =
    initialUserEmail || initialUserName
      ? { name: initialUserName || undefined, email: initialUserEmail }
      : null
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { hasPermission, loading, isOwner } = usePermissions()
  const { shellVisible, activeTab, workBoardParams, navigateAppTab, isAppTabActive } =
    useAppTabShell()
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleOverflow = useMemo(() => {
    if (loading) return overflowMenuItems.filter((i) => !i.requireOwner)
    return overflowMenuItems.filter((item) => {
      if (item.requireOwner && !isOwner) return false
      return !item.permission || hasPermission(item.permission)
    })
  }, [hasPermission, loading, isOwner])

  const isPrimaryActive = (key: PrimaryKey) => {
    if (shellVisible) {
      if (key === 'dashboard') return isAppTabActive('home')
      if (key === 'fichar') return isAppTabActive('fichar')
      if (key === 'newTask') {
        return (
          isAppTabActive('workBoard') &&
          workBoardParams.new === '1' &&
          workBoardParams.view === 'calendar'
        )
      }
      if (key === 'workBoard') {
        return isAppTabActive('workBoard') && workBoardParams.new !== '1'
      }
      return false
    }

    if (key === 'dashboard') return pathname === '/dashboard'
    if (key === 'fichar') return pathMatches(pathname, '/dashboard/fichar')
    if (key === 'newTask') {
      return (
        pathMatches(pathname, '/dashboard/work-board') &&
        !pathname.startsWith('/dashboard/work-board/productividad') &&
        searchParams.get('new') === '1'
      )
    }
    if (key === 'workBoard') {
      if (!pathMatches(pathname, '/dashboard/work-board')) return false
      if (pathname.startsWith('/dashboard/work-board/productividad')) return false
      if (searchParams.get('new') === '1') return false
      return true
    }
    return false
  }

  const hrefMatchesCurrent = (href: string) => {
    const [path, query] = href.split('?')
    if (!pathMatches(pathname, path)) return false
    if (!query) return pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
    const expected = new URLSearchParams(query)
    for (const [k, v] of expected.entries()) {
      if (searchParams.get(k) !== v) return false
    }
    return true
  }

  const cuentaActive = useMemo(() => {
    if (moreOpen) return true
    return visibleOverflow.some((item) => hrefMatchesCurrent(item.href))
  }, [moreOpen, visibleOverflow, pathname, searchParams])

  const canUse = (permission?: PermissionKey) => !permission || loading || hasPermission(permission)

  const handlePrimary = (key: PrimaryKey) => {
    const item = primaryBar.find((p) => p.key === key)
    if (!item) return
    if (item.newTask) {
      navigateAppTab('workBoard', { workBoardParams: WORK_BOARD_NEW_TASK_PARAMS })
      return
    }
    navigateAppTab(item.tab)
  }

  const handleOverflowClick = (item: (typeof overflowMenuItems)[number]) => {
    setMoreOpen(false)
    if (item.shellAgenda) {
      navigateAppTab('workBoard', {
        workBoardParams: { view: 'calendar', period: 'week' },
      })
      return
    }
    router.push(item.href)
  }

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[max(0.375rem,env(safe-area-inset-bottom))] px-3 pt-1.5"
        aria-label="Navegación principal"
      >
        <div
          className={cn(
            'pointer-events-auto mx-auto max-w-lg',
            'rounded-2xl border border-zinc-700/90 bg-zinc-950/95 shadow-xl shadow-black/40',
            'backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/90'
          )}
        >
          <ul className="grid grid-cols-5 gap-0 px-1 py-1.5">
            {primaryBar.map(({ key, label, icon: Icon, permission }) => {
              const allowed = canUse(permission)
              const active = allowed && isPrimaryActive(key)
              const itemClass =
                'flex w-full max-w-[5.5rem] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold leading-tight transition-colors'
              return (
                <li key={key} className="flex min-w-0 justify-center">
                  {allowed ? (
                    <button
                      type="button"
                      onClick={() => handlePrimary(key)}
                      aria-current={active ? 'page' : undefined}
                      aria-label={label}
                      className={cn(
                        itemClass,
                        active ? 'text-brand' : 'text-zinc-400 active:text-zinc-200'
                      )}
                    >
                      <Icon className={cn('h-6 w-6 shrink-0', active && 'text-brand')} aria-hidden />
                      <span className="line-clamp-2 text-center">{label}</span>
                    </button>
                  ) : (
                    <span
                      className={cn(itemClass, 'text-zinc-600 opacity-60')}
                      title="Sin permiso"
                    >
                      <Icon className="h-6 w-6 shrink-0" aria-hidden />
                      <span className="line-clamp-2 text-center">{label}</span>
                    </span>
                  )}
                </li>
              )
            })}
            <li className="flex min-w-0 justify-center">
              <button
                type="button"
                aria-label="Cuenta y más secciones"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'flex w-full max-w-[5.5rem] flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold leading-tight transition-colors',
                  cuentaActive ? 'text-brand' : 'text-zinc-400 active:text-zinc-200'
                )}
              >
                <UserCircle
                  className={cn('h-6 w-6 shrink-0', cuentaActive && 'text-brand')}
                  aria-hidden
                />
                <span className="line-clamp-2 text-center">Cuenta</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent
          showClose
          className={cn(
            'left-3 right-3 top-auto bottom-3 max-h-[min(85vh,calc(100dvh-5rem))] w-auto max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-2xl p-0',
            'border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl',
            'sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%]'
          )}
        >
          <DialogHeader className="border-b border-zinc-800 px-4 py-3 text-left">
            <DialogTitle className="font-display text-base">Cuenta</DialogTitle>
          </DialogHeader>
          {accountUser ? (
            <>
              <AccountMenuUserHeader
                user={accountUser}
                businessName={initialBusinessName || undefined}
                compact
              />
              <AccountMenuActions variant="sheet" onAction={() => setMoreOpen(false)} />
            </>
          ) : null}
          <p className="border-t border-zinc-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Más secciones
          </p>
          <ul className="max-h-[40vh] overflow-y-auto px-2 pb-3 pt-1">
            {visibleOverflow.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-zinc-500">No hay más secciones disponibles.</li>
            ) : (
              visibleOverflow.map((item) => {
                const { href, label, icon: Icon, shellAgenda } = item
                const active = hrefMatchesCurrent(href)
                if (shellAgenda) {
                  return (
                    <li key={href}>
                      <button
                        type="button"
                        onClick={() => handleOverflowClick(item)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                          activeTab === 'workBoard' &&
                            workBoardParams.view === 'calendar' &&
                            !workBoardParams.new
                            ? 'bg-zinc-800 text-brand'
                            : 'text-zinc-200 hover:bg-zinc-800/80'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                        {label}
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                        active ? 'bg-zinc-800 text-brand' : 'text-zinc-200 hover:bg-zinc-800/80'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                      {label}
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
