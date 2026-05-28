import type { LucideIcon } from 'lucide-react'
import {
  Home,
  Users,
  Briefcase,
  UserCircle,
  LayoutGrid,
  Settings,
  DollarSign,
  Clock,
  ChartColumnIncreasing,
  List,
  CalendarDays,
  FileText,
  FolderOpen,
  UsersRound,
  Umbrella,
  Shield,
  Building2,
  User,
  Bell,
  CreditCard,
  Plug,
  ScanLine,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { AppTabId } from '@/lib/app-shell/appTabRoutes'
import type { PermissionKey } from '@/lib/permissions'

export const DESKTOP_SIDEBAR_WIDTH_PX = 240

export type SidebarPermissionFilter = {
  hasPermission: (key: PermissionKey) => boolean
  isOwner: boolean
  loading: boolean
}

type SidebarNavBase = {
  id: string
  label: string
  icon: LucideIcon
  permission?: PermissionKey
  anyOf?: PermissionKey[]
  allOf?: PermissionKey[]
  requireOwner?: boolean
}

export type SidebarNavLeaf = SidebarNavBase & {
  kind: 'leaf'
  href: string
  appTab?: AppTabId
  /** Tab por defecto si href no lleva ?tab= */
  defaultTab?: string
}

export type SidebarNavGroup = SidebarNavBase & {
  kind: 'group'
  basePath: string
  children: SidebarNavLeaf[]
}

export type SidebarNavItem = SidebarNavLeaf | SidebarNavGroup

export const WORK_BOARD_HREF = '/dashboard/work-board'
export const PRODUCTIVIDAD_HREF = '/dashboard/work-board/productividad'

function leafChildren(items: Omit<SidebarNavLeaf, 'kind'>[]): SidebarNavLeaf[] {
  return items.map((item) => ({ ...item, kind: 'leaf' as const }))
}

const JORNADA_CHILDREN = leafChildren([
  { id: 'fichar', label: 'Fichar', icon: Clock, href: '/dashboard/fichar?tab=fichar', appTab: 'fichar', defaultTab: 'fichar' },
  { id: 'fichajes', label: 'Mis fichajes', icon: List, href: '/dashboard/fichar?tab=fichajes', appTab: 'fichar', defaultTab: 'fichajes' },
  { id: 'solicitudes', label: 'Solicitudes', icon: FileText, href: '/dashboard/fichar?tab=solicitudes', appTab: 'fichar', defaultTab: 'solicitudes' },
  { id: 'horario', label: 'Mi horario', icon: CalendarDays, href: '/dashboard/fichar?tab=horario', appTab: 'fichar', defaultTab: 'horario' },
  { id: 'documentos-jornada', label: 'Documentos', icon: FolderOpen, href: '/dashboard/fichar?tab=documentos', appTab: 'fichar', defaultTab: 'documentos' },
  {
    id: 'aprobaciones',
    label: 'Aprobaciones',
    icon: Users,
    href: '/dashboard/fichar?tab=aprobaciones',
    appTab: 'fichar',
    defaultTab: 'aprobaciones',
    permission: 'absences_manage',
  },
])

const ORGANIZACION_CHILDREN = leafChildren([
  { id: 'empleados', label: 'Empleados', icon: Users, href: '/dashboard/staff?tab=empleados', defaultTab: 'empleados', permission: 'staff_view' },
  { id: 'equipos', label: 'Equipos', icon: UsersRound, href: '/dashboard/staff?tab=equipos', defaultTab: 'equipos', anyOf: ['teams_view', 'teams_manage'] },
  { id: 'turnos', label: 'Turnos', icon: Clock, href: '/dashboard/staff?tab=turnos', defaultTab: 'turnos', permission: 'staff_view' },
  { id: 'fichajes-org', label: 'Fichajes', icon: List, href: '/dashboard/staff?tab=fichajes', defaultTab: 'fichajes', allOf: ['staff_view', 'time_tracking_view'] },
  { id: 'vacaciones', label: 'Vacaciones', icon: Umbrella, href: '/dashboard/staff?tab=vacaciones', defaultTab: 'vacaciones', allOf: ['staff_view', 'absences_view'] },
  { id: 'documentos-org', label: 'Documentos', icon: FileText, href: '/dashboard/staff?tab=documentos', defaultTab: 'documentos', allOf: ['staff_view', 'staff_edit'] },
  { id: 'roles', label: 'Roles', icon: UserCircle, href: '/dashboard/staff?tab=roles', defaultTab: 'roles', permission: 'staff_view' },
  { id: 'permisos', label: 'Permisos', icon: Shield, href: '/dashboard/staff?tab=permisos', defaultTab: 'permisos', permission: 'permissions_manage' },
])

const SETTINGS_CHILDREN = leafChildren([
  { id: 'general', label: 'General', icon: Building2, href: '/dashboard/settings?tab=general', defaultTab: 'general' },
  { id: 'account', label: 'Mi cuenta', icon: User, href: '/dashboard/settings?tab=account', defaultTab: 'account' },
  { id: 'hours', label: 'Horarios', icon: Clock, href: '/dashboard/settings?tab=hours', defaultTab: 'hours' },
  { id: 'booking', label: 'Reservas', icon: CalendarDays, href: '/dashboard/settings?tab=booking', defaultTab: 'booking' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, href: '/dashboard/settings?tab=notifications', defaultTab: 'notifications' },
  { id: 'billing', label: 'Facturación', icon: CreditCard, href: '/dashboard/settings?tab=billing', defaultTab: 'billing' },
  { id: 'integrations', label: 'Integraciones', icon: Plug, href: '/dashboard/settings?tab=integrations', defaultTab: 'integrations' },
  { id: 'clock', label: 'Fichaje', icon: ScanLine, href: '/dashboard/settings?tab=clock', defaultTab: 'clock' },
])

const FINANZAS_CHILDREN = leafChildren([
  { id: 'resumen', label: 'Resumen', icon: DollarSign, href: '/dashboard/finances?tab=resumen', defaultTab: 'resumen' },
  { id: 'ingresos', label: 'Ingresos', icon: TrendingUp, href: '/dashboard/finances?tab=ingresos', defaultTab: 'ingresos' },
  { id: 'gastos', label: 'Gastos', icon: TrendingDown, href: '/dashboard/finances?tab=gastos', defaultTab: 'gastos' },
  { id: 'reportes', label: 'Reportes', icon: FileText, href: '/dashboard/finances?tab=reportes', defaultTab: 'reportes' },
])

export const DESKTOP_SIDEBAR_NAV: SidebarNavItem[] = [
  { kind: 'leaf', id: 'inicio', label: 'Inicio', icon: Home, href: '/dashboard', appTab: 'home' },
  {
    kind: 'leaf',
    id: 'tablero',
    label: 'Tablero',
    icon: LayoutGrid,
    href: WORK_BOARD_HREF,
    appTab: 'workBoard',
    permission: 'work_board_view',
  },
  {
    kind: 'group',
    id: 'jornada',
    label: 'Jornada',
    icon: Clock,
    basePath: '/dashboard/fichar',
    children: JORNADA_CHILDREN,
  },
  { kind: 'leaf', id: 'clientes', label: 'Clientes', icon: Users, href: '/dashboard/clients', permission: 'clients_view' },
  { kind: 'leaf', id: 'servicios', label: 'Servicios', icon: Briefcase, href: '/dashboard/services', permission: 'services_view' },
  {
    kind: 'group',
    id: 'organizacion',
    label: 'Organización',
    icon: UserCircle,
    basePath: '/dashboard/staff',
    anyOf: ['staff_view', 'teams_view', 'teams_manage'],
    children: ORGANIZACION_CHILDREN,
  },
  {
    kind: 'leaf',
    id: 'productividad',
    label: 'Productividad',
    icon: ChartColumnIncreasing,
    href: PRODUCTIVIDAD_HREF,
    permission: 'tasks_metrics_view',
    requireOwner: true,
  },
  {
    kind: 'group',
    id: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    basePath: '/dashboard/finances',
    permission: 'finances_view',
    children: FINANZAS_CHILDREN,
  },
  {
    kind: 'group',
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    basePath: '/dashboard/settings',
    permission: 'settings_manage',
    children: SETTINGS_CHILDREN,
  },
]

function itemAllowed(item: SidebarNavBase, filter: SidebarPermissionFilter): boolean {
  if (filter.loading) {
    if (item.requireOwner) return false
    return true
  }
  if (item.requireOwner && !filter.isOwner) return false
  if (item.allOf?.length && !item.allOf.every((k) => filter.hasPermission(k))) return false
  if (item.anyOf?.length) return item.anyOf.some((k) => filter.hasPermission(k))
  return !item.permission || filter.hasPermission(item.permission)
}

export function filterSidebarNavItems(
  items: SidebarNavItem[],
  filter: SidebarPermissionFilter
): SidebarNavItem[] {
  return items
    .filter((item) => itemAllowed(item, filter))
    .map((item) => {
      if (item.kind !== 'group') return item
      const children = item.children.filter((child) => itemAllowed(child, filter))
      if (children.length === 0) return null
      return { ...item, children }
    })
    .filter((item): item is SidebarNavItem => item != null)
}

export function sidebarGroupIdForPath(pathname: string): string | null {
  if (pathname === '/dashboard/fichar' || pathname.startsWith('/dashboard/fichar/')) return 'jornada'
  if (
    pathname === '/dashboard/staff' ||
    pathname.startsWith('/dashboard/staff/') ||
    pathname.startsWith('/dashboard/teams')
  ) {
    return 'organizacion'
  }
  if (pathname.startsWith('/dashboard/settings')) return 'configuracion'
  if (pathname.startsWith('/dashboard/finances')) return 'finanzas'
  return null
}

function parseHref(href: string): { path: string; tab: string | null } {
  const qIndex = href.indexOf('?')
  const path = qIndex >= 0 ? href.slice(0, qIndex) : href
  const query = qIndex >= 0 ? href.slice(qIndex + 1) : ''
  const tab = new URLSearchParams(query).get('tab')
  return { path, tab }
}

export function sidebarLeafIsActive(
  pathname: string,
  searchParams: URLSearchParams,
  leaf: Pick<SidebarNavLeaf, 'href' | 'defaultTab'>
): boolean {
  const { path, tab } = parseHref(leaf.href)
  const pathMatches =
    pathname === path ||
    (path !== '/dashboard' && pathname.startsWith(`${path}/`))

  if (!pathMatches) return false
  if (!tab) return true

  const currentTab = searchParams.get('tab')
  if (currentTab) return currentTab === tab
  return leaf.defaultTab === tab
}

export function sidebarItemIsActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: SidebarNavItem
): boolean {
  if (item.kind === 'group') {
    return sidebarGroupIdForPath(pathname) === item.id
  }

  const { path } = parseHref(item.href)

  if (path === '/dashboard') return pathname === '/dashboard'
  if (path === WORK_BOARD_HREF) {
    if (!pathname.startsWith(WORK_BOARD_HREF)) return false
    if (pathname === WORK_BOARD_HREF) return true
    if (pathname.startsWith(PRODUCTIVIDAD_HREF)) return false
    return pathname.startsWith(`${WORK_BOARD_HREF}/`)
  }
  if (path === PRODUCTIVIDAD_HREF) {
    return pathname === PRODUCTIVIDAD_HREF || pathname.startsWith(`${PRODUCTIVIDAD_HREF}/`)
  }

  if (parseHref(item.href).tab) {
    return sidebarLeafIsActive(pathname, searchParams, item)
  }

  return pathname === path || pathname.startsWith(`${path}/`)
}

export function findSidebarGroup(
  items: SidebarNavItem[],
  groupId: string
): SidebarNavGroup | null {
  const found = items.find((item) => item.kind === 'group' && item.id === groupId)
  return found?.kind === 'group' ? found : null
}
