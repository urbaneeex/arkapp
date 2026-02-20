'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Users,
  Briefcase,
  UserCircle,
  Calendar,
  Settings,
  BarChart3,
  DollarSign,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBusinessForUserClient } from '@/lib/supabase/business-client'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/stores/business'
import { useSidebarStore } from '@/stores/sidebar'
import { Tooltip } from '@/components/ui/tooltip'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/lib/permissions'

const mainNavItems: { href: string; label: string; icon: typeof Home; permission?: PermissionKey }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/calendar', label: 'Calendario', icon: Calendar, permission: 'calendar_view' },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users, permission: 'clients_view' },
  { href: '/dashboard/services', label: 'Servicios', icon: Briefcase, permission: 'services_view' },
  { href: '/dashboard/staff', label: 'Equipo', icon: UserCircle, permission: 'staff_view' },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, permission: 'reports_view' },
  { href: '/dashboard/finances', label: 'Finanzas', icon: DollarSign, permission: 'finances_view' },
]

const iconSize = 'w-7 h-7'

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const setBusiness = useBusinessStore((s) => s.setBusiness)
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggle)
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const supabase = createClient()

  const visibleNavItems = mainNavItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )

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

  const isCollapsed = collapsed

  return (
    <>
      <button
        type="button"
        className="cursor-pointer lg:hidden fixed top-[4.5rem] left-4 z-40 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir menú"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside
        className={cn(
          'fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transform transition-[width,transform] duration-200 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          'w-64',
          'lg:w-64',
          isCollapsed && 'lg:w-[4.5rem]'
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            'hidden lg:flex absolute z-50 top-5 right-0 w-6 h-6 items-center justify-center rounded-full bg-zinc-200 border border-zinc-300 shadow-md text-zinc-600 hover:bg-zinc-300 hover:text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 cursor-pointer',
            'translate-x-1/2'
          )}
          aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
          title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>

        <div className="flex flex-col h-full pt-1 pb-4">
          <nav className="flex-1 px-3 pt-2 space-y-2 overflow-y-auto">
            {(permissionsLoading ? mainNavItems : visibleNavItems).map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== '/dashboard' && pathname.startsWith(href))
              const linkEl = (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-label={label}
                  className={cn(
                    'cursor-pointer flex items-center rounded-lg text-sm font-medium transition-colors min-h-[2.5rem] relative',
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 pl-3 pr-3 py-2.5',
                    isActive
                      ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100'
                      : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#3B82F6]"
                      aria-hidden
                    />
                  )}
                  <Icon className={cn('shrink-0', iconSize, isActive && 'text-[#3B82F6] dark:text-[#3B82F6]')} />
                  {!isCollapsed && <span>{label}</span>}
                </Link>
              )
              return isCollapsed ? (
                <Tooltip key={href} content={label} className="w-full flex items-center justify-center">
                  {linkEl}
                </Tooltip>
              ) : (
                linkEl
              )
            })}
          </nav>

          <div className={cn('pt-4 pb-4 space-y-1 flex flex-col items-stretch', 'px-3')}>
            {(permissionsLoading || hasPermission('settings_manage')) && (isCollapsed ? (
              <Tooltip content="Configuración" className="w-full flex items-center justify-center">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setOpen(false)}
                  aria-label="Configuración"
                  className={cn(
                    'cursor-pointer flex items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[2.5rem] relative px-2 py-2.5',
                    pathname.startsWith('/dashboard/settings')
                      ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100'
                      : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                  )}
                >
                  {pathname.startsWith('/dashboard/settings') && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#3B82F6]" aria-hidden />
                  )}
                  <Settings className={cn('shrink-0', iconSize, pathname.startsWith('/dashboard/settings') && 'text-[#3B82F6]')} />
                </Link>
              </Tooltip>
            ) : (
              <Link
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className={cn(
                  'cursor-pointer flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative',
                  pathname.startsWith('/dashboard/settings')
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
                )}
              >
                {pathname.startsWith('/dashboard/settings') && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#3B82F6]" aria-hidden />
                )}
                <Settings className={cn('shrink-0', iconSize, pathname.startsWith('/dashboard/settings') && 'text-[#3B82F6]')} />
                <span>Configuración</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="cursor-pointer fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  )
}
