import type { LucideIcon } from 'lucide-react'
import {
  Users,
  Briefcase,
  Contact,
  DollarSign,
  Settings,
  ChartColumnIncreasing,
} from 'lucide-react'
import type { PermissionKey } from '@/lib/permissions'

export type MobileOverflowNavItem = {
  id: string
  href: string
  label: string
  icon: LucideIcon
  permission?: PermissionKey
  requireOwner?: boolean
}

export const MOBILE_OVERFLOW_NAV_ITEMS: MobileOverflowNavItem[] = [
  { id: 'clients', href: '/dashboard/clients', label: 'Clientes', icon: Users, permission: 'clients_view' },
  { id: 'services', href: '/dashboard/services', label: 'Servicios', icon: Briefcase, permission: 'services_view' },
  { id: 'staff', href: '/dashboard/staff', label: 'Equipo', icon: Contact, permission: 'staff_view' },
  {
    id: 'productividad',
    href: '/dashboard/work-board/productividad',
    label: 'Productividad',
    icon: ChartColumnIncreasing,
    permission: 'tasks_metrics_view',
    requireOwner: true,
  },
  { id: 'finances', href: '/dashboard/finances', label: 'Finanzas', icon: DollarSign, permission: 'finances_view' },
  { id: 'settings', href: '/dashboard/settings', label: 'Configuración', icon: Settings, permission: 'settings_manage' },
]

export function matchMobileOverflowPath(pathname: string, href: string): boolean {
  const path = href.split('?')[0]
  if (pathname === path) return true
  if (path !== '/dashboard' && pathname.startsWith(`${path}/`)) return true
  return false
}

export function getMobileOverflowItemForPath(pathname: string): MobileOverflowNavItem | null {
  return (
    MOBILE_OVERFLOW_NAV_ITEMS.find((item) => matchMobileOverflowPath(pathname, item.href)) ?? null
  )
}

export function hrefWithStackAccount(href: string): string {
  const qIndex = href.indexOf('?')
  const path = qIndex >= 0 ? href.slice(0, qIndex) : href
  const query = qIndex >= 0 ? href.slice(qIndex + 1) : ''
  const params = new URLSearchParams(query)
  params.set('stack', 'account')
  return `${path}?${params.toString()}`
}
