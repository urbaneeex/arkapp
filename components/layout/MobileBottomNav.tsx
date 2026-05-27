'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Home,
  LayoutGrid,
  CirclePlus,
  Clock,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchAppTabQueries } from '@/lib/app-shell/prefetchAppTabQueries'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/lib/permissions'
import { useAppTabShell } from '@/components/app-shell/AppTabShellProvider'
import { WORK_BOARD_NEW_TASK_PARAMS } from '@/lib/app-shell/appTabRoutes'
import { MOBILE_OVERFLOW_NAV_ITEMS, matchMobileOverflowPath, getMobileOverflowItemForPath } from '@/lib/app-shell/mobileOverflowNav'

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
  { key: 'fichar', tab: 'fichar', label: 'Jornada', icon: Clock },
]

function pathMatches(pathname: string, path: string) {
  return pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
}

export function MobileBottomNav({
  initialUserName: _initialUserName = '',
  initialUserEmail: _initialUserEmail = '',
  initialBusinessName: _initialBusinessName = '',
}: {
  initialUserName?: string
  initialUserEmail?: string
  initialBusinessName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { hasPermission, loading, isOwner } = usePermissions()
  const { shellVisible, activeTab, workBoardParams, navigateAppTab, requestLeaveNewTask, isAppTabActive } =
    useAppTabShell()
  const queryClient = useQueryClient()

  const visibleOverflow = useMemo(() => {
    if (loading) return MOBILE_OVERFLOW_NAV_ITEMS.filter((i) => !i.requireOwner)
    return MOBILE_OVERFLOW_NAV_ITEMS.filter((item) => {
      if (item.requireOwner && !isOwner) return false
      if (item.anyOf?.length) return item.anyOf.some((k) => hasPermission(k))
      return !item.permission || hasPermission(item.permission)
    })
  }, [hasPermission, loading, isOwner])

  const isPrimaryActive = (key: PrimaryKey) => {
    if (shellVisible) {
      if (key === 'dashboard') return isAppTabActive('home')
      if (key === 'fichar') return isAppTabActive('fichar')
      if (key === 'newTask') {
        return isAppTabActive('workBoard') && workBoardParams.new === '1'
      }
      if (key === 'workBoard') {
        return isAppTabActive('workBoard') && workBoardParams.new !== '1'
      }
      return false
    }

    if (key === 'dashboard') return pathname === '/dashboard' && searchParams.get('panel') !== 'account'
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

  const cuentaActive = useMemo(() => {
    if (shellVisible && activeTab === 'account') return true
    if (pathname === '/dashboard' && searchParams.get('panel') === 'account') return true
    if (searchParams.get('stack') === 'account' && getMobileOverflowItemForPath(pathname)) return true
    return visibleOverflow.some((item) => matchMobileOverflowPath(pathname, item.href))
  }, [shellVisible, activeTab, visibleOverflow, pathname, searchParams])

  const canUse = (permission?: PermissionKey) => !permission || loading || hasPermission(permission)

  const handlePrimary = (key: PrimaryKey) => {
    const item = primaryBar.find((p) => p.key === key)
    if (!item) return
    if (item.newTask) {
      prefetchAppTabQueries(queryClient, 'workBoard')
      navigateAppTab('workBoard', { workBoardParams: WORK_BOARD_NEW_TASK_PARAMS })
      return
    }
    prefetchAppTabQueries(queryClient, item.tab)
    navigateAppTab(item.tab)
  }

  const handleAccount = () => {
    if (shellVisible) {
      navigateAppTab('account')
      return
    }
    requestLeaveNewTask({ kind: 'fn', fn: () => router.push('/dashboard?panel=account') })
  }

  return (
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
                    onPointerDown={() => {
                      const item = primaryBar.find((p) => p.key === key)
                      if (item && !item.newTask) prefetchAppTabQueries(queryClient, item.tab)
                      else if (item?.newTask) prefetchAppTabQueries(queryClient, 'workBoard')
                    }}
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
              aria-current={cuentaActive ? 'page' : undefined}
              onClick={handleAccount}
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
  )
}
