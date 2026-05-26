'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Users,
  Briefcase,
  UserCircle,
  LayoutGrid,
  Settings,
  DollarSign,
  Clock,
  UsersRound,
  ChartColumnIncreasing,
} from 'lucide-react'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBusinessForUserClient } from '@/lib/supabase/business-client'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/stores/business'
import { Tooltip } from '@/components/ui/tooltip'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/lib/permissions'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { isAppShellTabHref } from '@/lib/app-shell/appTabRoutes'

const WORK_BOARD_HREF = '/dashboard/work-board'
const PRODUCTIVIDAD_HREF = '/dashboard/work-board/productividad'

function sidebarItemIsActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === WORK_BOARD_HREF) {
    if (!pathname.startsWith(WORK_BOARD_HREF)) return false
    if (pathname === WORK_BOARD_HREF) return true
    if (pathname.startsWith(PRODUCTIVIDAD_HREF)) return false
    return pathname.startsWith(`${WORK_BOARD_HREF}/`)
  }
  if (href === PRODUCTIVIDAD_HREF) {
    return pathname === PRODUCTIVIDAD_HREF || pathname.startsWith(`${PRODUCTIVIDAD_HREF}/`)
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

const mainNavItems: {
  href: string
  label: string
  icon: typeof Home
  permission?: PermissionKey
  anyOf?: PermissionKey[]
  requireOwner?: boolean
}[] = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/dashboard/work-board', label: 'Tablero', icon: LayoutGrid, permission: 'work_board_view' },
  { href: '/dashboard/fichar', label: 'Fichar', icon: Clock },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users, permission: 'clients_view' },
  { href: '/dashboard/services', label: 'Servicios', icon: Briefcase, permission: 'services_view' },
  { href: '/dashboard/staff', label: 'Equipo', icon: UserCircle, permission: 'staff_view' },
  {
    href: '/dashboard/teams',
    label: 'Equipos',
    icon: UsersRound,
    anyOf: ['teams_view', 'teams_manage'],
  },
  {
    href: PRODUCTIVIDAD_HREF,
    label: 'Productividad',
    icon: ChartColumnIncreasing,
    permission: 'tasks_metrics_view',
    requireOwner: true,
  },
  { href: '/dashboard/finances', label: 'Finanzas', icon: DollarSign, permission: 'finances_view' },
]

const iconSize = 'w-7 h-7'

export function Sidebar() {
  const pathname = usePathname()
  const { navigateAppTab, isAppTabActive } = useAppTabShell()
  const setBusiness = useBusinessStore((s) => s.setBusiness)
  const { hasPermission, loading: permissionsLoading, isOwner } = usePermissions()
  const supabase = createClient()

  const visibleNavItems = mainNavItems.filter((item) => {
    if (item.requireOwner && !isOwner) return false
    if (item.anyOf?.length) return item.anyOf.some((k) => hasPermission(k))
    return !item.permission || hasPermission(item.permission)
  })

  const navItemsToShow = permissionsLoading
    ? mainNavItems.filter((i) => !i.requireOwner)
    : visibleNavItems

  useEffect(() => {
    const load = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) return

      const businessData = await getBusinessForUserClient(authUser.id)
      setBusiness(businessData)
    }
    load()
  }, [supabase, setBusiness])

  return (
    <aside className="hidden lg:block fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-[4.5rem] bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col h-full pt-1 pb-4">
        <nav className="flex-1 px-3 pt-2 space-y-2 overflow-y-hidden">
          {navItemsToShow.map(({ href, label, icon: Icon }) => {
            const shellTab = isAppShellTabHref(href)
            const isActive = shellTab
              ? isAppTabActive(shellTab)
              : sidebarItemIsActive(pathname, href)
            const itemClass = cn(
              'cursor-pointer flex items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[2.5rem] relative px-2 py-2.5',
              isActive
                ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100'
                : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
            )
            return (
              <Tooltip key={href} content={label} className="w-full flex items-center justify-center">
                {shellTab ? (
                  <button
                    type="button"
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => navigateAppTab(shellTab)}
                    className={itemClass}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand"
                        aria-hidden
                      />
                    )}
                    <Icon className={cn('shrink-0', iconSize, isActive && 'text-brand dark:text-brand')} />
                  </button>
                ) : (
                  <Link href={href} aria-label={label} className={itemClass}>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand"
                        aria-hidden
                      />
                    )}
                    <Icon className={cn('shrink-0', iconSize, isActive && 'text-brand dark:text-brand')} />
                  </Link>
                )}
              </Tooltip>
            )
          })}
        </nav>

        <div className={cn('pt-4 pb-4 space-y-1 flex flex-col items-stretch', 'px-3')}>
          {(permissionsLoading || hasPermission('settings_manage')) && (
            <Tooltip content="Configuración" className="w-full flex items-center justify-center">
              <Link
                href="/dashboard/settings"
                aria-label="Configuración"
                className={cn(
                  'cursor-pointer flex items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[2.5rem] relative px-2 py-2.5',
                  pathname.startsWith('/dashboard/settings')
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                )}
              >
                {pathname.startsWith('/dashboard/settings') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand" aria-hidden />
                )}
                <Settings className={cn('shrink-0', iconSize, pathname.startsWith('/dashboard/settings') && 'text-brand')} />
              </Link>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  )
}
