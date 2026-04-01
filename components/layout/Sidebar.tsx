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
} from 'lucide-react'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBusinessForUserClient } from '@/lib/supabase/business-client'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/stores/business'
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
  const setBusiness = useBusinessStore((s) => s.setBusiness)
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

  return (
    <aside className="hidden lg:block fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-[4.5rem] bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col h-full pt-1 pb-4">
        <nav className="flex-1 px-3 pt-2 space-y-2 overflow-y-hidden">
          {(permissionsLoading ? mainNavItems : visibleNavItems).map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Tooltip key={href} content={label} className="w-full flex items-center justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  className={cn(
                    'cursor-pointer flex items-center justify-center rounded-lg text-sm font-medium transition-colors min-h-[2.5rem] relative px-2 py-2.5',
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
                </Link>
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
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#3B82F6]" aria-hidden />
                )}
                <Settings className={cn('shrink-0', iconSize, pathname.startsWith('/dashboard/settings') && 'text-[#3B82F6]')} />
              </Link>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  )
}
